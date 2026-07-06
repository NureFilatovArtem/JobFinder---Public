/**
 * Vacancy Expiration Checker
 *
 * Reads active vacancy URLs from the database, checks if they're expired,
 * and DELETES expired vacancies from the database.
 *
 * Run manually:    node scripts/checkExpiredVacancies.js
 * Run with limit:  node scripts/checkExpiredVacancies.js --limit=500
 * Dry run:         node scripts/checkExpiredVacancies.js --dry-run
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { query } = require('../database/postgres');

// ═══════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════

const DEFAULT_BATCH_LIMIT = 200;
const CONCURRENCY = 8;
const DELAY_BETWEEN_BATCHES_MS = 600;
const HTTP_TIMEOUT_MS = 10000;
const MAX_RETRIES = 2;

// Per-domain concurrency limits
const DOMAIN_CONCURRENCY = {
    'linkedin.com': 2,
    'indeed.com': 2,
    'indeed.be': 2,
    'glassdoor.com': 2,
};

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'nl-BE,nl;q=0.9,en-US,en;q=0.8,fr;q=0.5',
};

// Expiration phrases — must match vacancyCleanupService.js
const EXPIRED_PHRASES = [
    // English — LinkedIn, Indeed, generic
    'no longer accepting applications',
    'this job is no longer available',
    'this job has expired',
    'this job has expired on indeed',
    'the employer is not accepting applications',
    'the employer is no longer accepting applications',
    'is not actively hiring',
    'this job listing is no longer available',
    'this position has been filled',
    'position has been filled',
    'this position is no longer available',
    'job is closed',
    'this vacancy is closed',
    'vacancy closed',
    'application deadline has passed',
    'this job posting has expired',
    'job posting has been removed',
    'this job is not available',
    'job is no longer active',
    'listing has expired',
    'this listing has expired',
    'job has been removed',
    'no longer available for this job',
    'this role is no longer available',
    'this opportunity is no longer available',
    'applications are closed',
    'vacancy no longer exists',
    'sorry, this job has expired',
    'this job post is no longer accepting applications',
    'this job was removed by the employer',
    "doesn't accept new applicants",
    // Dutch — generic
    'vacature gesloten',
    'niet meer beschikbaar',
    'niet langer beschikbaar',
    'deze vacature is gesloten',
    'sollicitaties worden niet meer aangenomen',
    'verlopen vacature',
    'vacature vervallen',
    'deze vacature is verlopen',
    'aanmelden niet meer mogelijk',
    'vacature is verlopen',
    'vacature is niet meer beschikbaar',
    'niet meer actief',
    'deze vacature bestaat niet meer',
    'deze functie is niet meer vacant',
    'deze vacature is niet meer beschikbaar',
    'deze job is niet meer beschikbaar',
    'solliciteren is niet meer mogelijk',
    // Dutch — Adzuna BE/NL expired page variants
    'helaas, deze vacature is niet meer beschikbaar',
    'helaas is deze vacature niet meer beschikbaar',
    'deze vacature is helaas niet meer beschikbaar',
    'deze vacature is niet langer beschikbaar',
    'vacature is niet meer beschikbaar',
    'deze job is helaas niet meer beschikbaar',
    'sorry, deze vacature bestaat niet meer',
    'helaas, deze job is niet meer beschikbaar',
    'vacature niet meer beschikbaar',
    // French
    "offre n'est plus disponible",
    'offre expirée',
    'cette offre a expiré',
    "cette offre d'emploi n'est plus disponible",
    "cette offre n'est plus disponible",
    "ce poste n'est plus vacant",
    'les candidatures sont clôturées',
    // German
    'stelle nicht mehr verfügbar',
    'diese stelle ist nicht mehr verfügbar',
    'bewerbung nicht mehr möglich',
];

// URL path patterns indicating a homepage/generic listing redirect
const LISTING_PATH_RE = /^\/?(jobs|vacatures|vacancies|careers|offres|werk|stellenangebote)?\/?$/i;

// ═══════════════════════════════════════════════
// CLI ARGUMENTS
// ═══════════════════════════════════════════════

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitArg = args.find(a => a.startsWith('--limit'));
const BATCH_LIMIT = limitArg
    ? parseInt(limitArg.split('=')[1] || args[args.indexOf('--limit') + 1]) || DEFAULT_BATCH_LIMIT
    : DEFAULT_BATCH_LIMIT;

// ═══════════════════════════════════════════════
// DATABASE FUNCTIONS
// ═══════════════════════════════════════════════

async function fetchVacanciesToCheck(limit) {
    const result = await query(
        `SELECT id, COALESCE(NULLIF(link, ''), source_url) AS url, title, company, source
         FROM vacancies
         WHERE is_active = true
           AND (link IS NOT NULL AND link != ''
                OR source_url IS NOT NULL AND source_url != '')
         ORDER BY last_checked_at ASC NULLS FIRST, scraped_at ASC
         LIMIT $1`,
        [limit]
    );
    return result.rows;
}

async function deleteExpiredVacancy(id) {
    await query('DELETE FROM user_vacancy_scores WHERE vacancy_id = $1', [id]);
    await query('DELETE FROM vacancies WHERE id = $1', [id]);
}

async function markAsChecked(id) {
    await query('UPDATE vacancies SET last_checked_at = NOW() WHERE id = $1', [id]);
}

// ═══════════════════════════════════════════════
// REDIRECT ANALYSIS
// ═══════════════════════════════════════════════

function analyzeRedirect(originalUrl, finalUrl, httpStatus) {
    try {
        const orig  = new URL(originalUrl);
        const final = new URL(finalUrl);

        const origHost  = orig.hostname.replace(/^www\./, '');
        const finalHost = final.hostname.replace(/^www\./, '');

        if (origHost !== finalHost) {
            return { expired: true, reason: `Redirected to different domain: ${finalHost}` };
        }

        const finalPath = final.pathname;
        if (LISTING_PATH_RE.test(finalPath)) {
            return { expired: true, reason: `Redirected to listing/root: ${finalPath}` };
        }

        const origDepth  = orig.pathname.split('/').filter(Boolean).length;
        const finalDepth = final.pathname.split('/').filter(Boolean).length;
        if (origDepth >= 3 && finalDepth <= 1) {
            return { expired: true, reason: `Redirected to shallow path: ${finalPath}` };
        }
    } catch { /* malformed URL */ }

    return { expired: false, reason: null };
}

// ═══════════════════════════════════════════════
// URL CHECKER
// ═══════════════════════════════════════════════

async function checkUrl(url) {
    try {
        const { default: fetch } = await import('node-fetch');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

        const response = await fetch(url, {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal,
            headers: HEADERS,
        });

        clearTimeout(timeout);
        const httpStatus = response.status;

        if (httpStatus === 404 || httpStatus === 410) {
            return { status: 'expired', matchedPhrase: null, httpStatus, error: `HTTP ${httpStatus}` };
        }

        if (httpStatus === 403 || httpStatus === 429) {
            return { status: 'error', matchedPhrase: null, httpStatus, error: `HTTP ${httpStatus} — rate-limited/blocked` };
        }

        if (httpStatus >= 500) {
            return { status: 'error', matchedPhrase: null, httpStatus, error: `HTTP ${httpStatus} — server error` };
        }

        // Detect homepage redirect via final URL (node-fetch exposes response.url)
        if (response.url && response.url !== url) {
            const { expired, reason } = analyzeRedirect(url, response.url, httpStatus);
            if (expired) {
                return { status: 'expired', matchedPhrase: null, httpStatus, error: reason };
            }
        }

        // Scan page text for expiration phrases
        const html = (await response.text()).toLowerCase();
        for (const phrase of EXPIRED_PHRASES) {
            if (html.includes(phrase)) {
                return { status: 'expired', matchedPhrase: phrase, httpStatus, error: null };
            }
        }

        return { status: 'active', matchedPhrase: null, httpStatus, error: null };

    } catch (err) {
        const errorMsg = err.name === 'AbortError' ? 'Timeout' : err.message;
        return { status: 'error', matchedPhrase: null, httpStatus: null, error: errorMsg };
    }
}

async function checkUrlWithRetry(url, retries = MAX_RETRIES) {
    let lastResult = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
        lastResult = await checkUrl(url);

        // Got an HTTP response (any status) or definitive result — no retry
        if (lastResult.httpStatus !== null || !lastResult.error) return lastResult;

        // Pure network error — wait then retry
        if (attempt < retries) {
            await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
        }
    }
    return lastResult;
}

// ═══════════════════════════════════════════════
// CONCURRENCY HELPERS
// ═══════════════════════════════════════════════

function getDomain(url) {
    try { return new URL(url).hostname.replace('www.', ''); }
    catch { return 'unknown'; }
}

async function checkBatch(items) {
    const results = [];
    const totalBatches = Math.ceil(items.length / CONCURRENCY);

    for (let i = 0; i < items.length; i += CONCURRENCY) {
        const batch     = items.slice(i, i + CONCURRENCY);
        const batchNum  = Math.floor(i / CONCURRENCY) + 1;

        console.log(`\n⏳ Batch ${batchNum}/${totalBatches} (${batch.length} URLs)...`);

        const batchResults = await Promise.all(
            batch.map(async (item) => {
                const result = await checkUrlWithRetry(item.url);
                const icon   = result.status === 'active' ? '✅' : result.status === 'expired' ? '❌' : '⚠️';
                const detail = result.matchedPhrase
                    ? `Matched: "${result.matchedPhrase}"`
                    : result.error || `HTTP ${result.httpStatus}`;

                console.log(`  ${icon} [ID:${item.id}] ${result.status.toUpperCase()} — ${detail}`);
                console.log(`     └─ ${(item.title || '').substring(0, 60)} (${getDomain(item.url)})`);

                return { ...item, ...result };
            })
        );

        results.push(...batchResults);

        if (i + CONCURRENCY < items.length) {
            await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES_MS));
        }
    }

    return results;
}

// ═══════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════

async function main() {
    console.log('🔍 Vacancy Expiration Checker');
    console.log(`   Mode:        ${DRY_RUN ? '🧪 DRY RUN (no DB changes)' : '🔴 LIVE (will delete expired)'}`);
    console.log(`   Phrases:     ${EXPIRED_PHRASES.length}`);
    console.log(`   Batch limit: ${BATCH_LIMIT}`);
    console.log(`   Concurrency: ${CONCURRENCY}`);
    console.log(`   Retries:     ${MAX_RETRIES} per URL`);
    console.log(`   Timeout:     ${HTTP_TIMEOUT_MS}ms per attempt`);

    console.log('\n📦 Fetching vacancies from database...');
    const vacancies = await fetchVacanciesToCheck(BATCH_LIMIT);
    console.log(`   Found ${vacancies.length} vacancies to check.`);

    if (vacancies.length === 0) {
        console.log('✅ No vacancies to check. Exiting.');
        return;
    }

    const startTime = Date.now();
    const results   = await checkBatch(vacancies);
    const elapsed   = ((Date.now() - startTime) / 1000).toFixed(1);

    const active  = results.filter(r => r.status === 'active');
    const expired = results.filter(r => r.status === 'expired');
    const errors  = results.filter(r => r.status === 'error');
    const successRate = ((( results.length - errors.length) / results.length) * 100).toFixed(1);

    if (!DRY_RUN) {
        console.log('\n🗑️  Applying database changes...');

        let deleteCount = 0;
        for (const item of expired) {
            try {
                await deleteExpiredVacancy(item.id);
                deleteCount++;
            } catch (err) {
                console.error(`  ❌ Failed to delete vacancy ${item.id}: ${err.message}`);
            }
        }
        console.log(`   Deleted ${deleteCount} expired vacancies.`);

        let checkedCount = 0;
        for (const item of [...active, ...errors]) {
            try {
                await markAsChecked(item.id);
                checkedCount++;
            } catch (err) {
                console.error(`  ❌ Failed to update last_checked_at for ${item.id}: ${err.message}`);
            }
        }
        console.log(`   Updated last_checked_at for ${checkedCount} vacancies.`);
    }

    console.log(`\n${'═'.repeat(55)}`);
    console.log(`📊 RESULTS (${elapsed}s)`);
    console.log(`   ✅ Active:   ${active.length}`);
    console.log(`   ❌ Expired:  ${expired.length}${DRY_RUN ? ' (not deleted — dry run)' : ' (deleted)'}`);
    console.log(`   ⚠️  Errors:   ${errors.length}`);
    console.log(`   📈 Success rate: ${successRate}%`);
    console.log(`${'═'.repeat(55)}`);

    if (expired.length > 0) {
        console.log('\n❌ Expired vacancies:');
        expired.forEach(item => {
            const reason = item.matchedPhrase ? `"${item.matchedPhrase}"` : item.error || `HTTP ${item.httpStatus}`;
            console.log(`   - [ID:${item.id}] ${(item.title || '').substring(0, 60)} (${reason})`);
        });
    }

    if (errors.length > 0) {
        console.log('\n⚠️  Errors (will retry next run):');
        errors.forEach(item => {
            console.log(`   - [ID:${item.id}] ${(item.title || '').substring(0, 50)} → ${item.error}`);
        });
    }
}

if (require.main === module) {
    main().then(() => process.exit(0)).catch(e => {
        console.error('Fatal:', e);
        process.exit(1);
    });
}

module.exports = { checkUrl, checkUrlWithRetry, checkBatch, EXPIRED_PHRASES, fetchVacanciesToCheck };
