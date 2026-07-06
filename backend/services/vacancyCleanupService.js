/**
 * Vacancy Cleanup Service
 *
 * Checks active vacancies for staleness concurrently and soft-deletes inactive ones.
 * - CONCURRENCY: processes 8 URLs in parallel per batch
 * - Retries transient network errors up to 2 times
 * - Detects homepage redirects (expired job → root/listing redirect)
 * - Enforces a configurable daily deletion cap
 */

const { query } = require('../database/postgres');
const axios = require('axios');
const cheerio = require('cheerio');

const MAX_DELETIONS_PER_DAY = 200;
const CHECK_INTERVAL_DAYS = 3;
const HTTP_TIMEOUT_MS = 10000;
const MAX_RETRIES = 2;
const CONCURRENCY = 8;
const BATCH_DELAY_MS = 500;

// Text patterns indicating an expired/closed job posting (checked case-insensitively)
const INACTIVE_TEXT_PATTERNS = [
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

// URL path patterns that indicate a redirect to a homepage / generic listing (job is gone)
const LISTING_PATH_RE = /^\/?(jobs|vacatures|vacancies|careers|offres|werk|stellenangebote)?\/?$/i;

class VacancyCleanupService {

    /**
     * Fetch active vacancies not checked recently.
     * Falls back to `link` when `source_url` is empty.
     */
    async getStaleVacancies(limit = 600) {
        const result = await query(
            `SELECT id, title, source,
                    COALESCE(NULLIF(source_url, ''), link) AS source_url,
                    scraped_at, last_cleanup_check
             FROM vacancies
             WHERE is_active = true
               AND (
                   (source_url IS NOT NULL AND source_url != '')
                   OR (link IS NOT NULL AND link != '')
               )
               AND (last_cleanup_check IS NULL
                    OR last_cleanup_check < NOW() - INTERVAL '${CHECK_INTERVAL_DAYS} days')
             ORDER BY last_cleanup_check ASC NULLS FIRST, scraped_at ASC
             LIMIT $1`,
            [limit]
        );
        return result.rows;
    }

    /**
     * Analyse a redirect: returns an inactive result if the final URL looks like
     * a homepage/listing redirect, null if the redirect looks legitimate.
     */
    _analyzeRedirect(originalUrl, finalUrl, statusCode) {
        try {
            const orig  = new URL(originalUrl);
            const final = new URL(finalUrl);

            const origHost  = orig.hostname.replace(/^www\./, '');
            const finalHost = final.hostname.replace(/^www\./, '');

            // Redirected to a completely different domain
            if (origHost !== finalHost) {
                return {
                    isActive: false, statusCode,
                    reason: `Redirected to different domain: ${finalHost}`, error: null,
                };
            }

            const finalPath = final.pathname;

            // Redirected to root or a generic listing page
            if (LISTING_PATH_RE.test(finalPath)) {
                return {
                    isActive: false, statusCode,
                    reason: `Redirected to listing/root: ${finalPath}`, error: null,
                };
            }

            // Original path was deep (/jobs/view/123456) but final is shallow (/jobs)
            const origDepth  = orig.pathname.split('/').filter(Boolean).length;
            const finalDepth = final.pathname.split('/').filter(Boolean).length;
            if (origDepth >= 3 && finalDepth <= 1) {
                return {
                    isActive: false, statusCode,
                    reason: `Redirected to shallow path: ${finalPath}`, error: null,
                };
            }
        } catch { /* malformed URL — ignore */ }

        return null;
    }

    /**
     * Fetch a vacancy URL and determine whether the posting is still active.
     * Returns: { isActive, statusCode, reason, error }
     */
    async checkVacancyActivity(vacancy) {
        const url = vacancy.source_url;
        if (!url) {
            return { isActive: false, statusCode: null, reason: 'No URL', error: 'No URL' };
        }

        try {
            const response = await axios.get(url, {
                timeout: HTTP_TIMEOUT_MS,
                maxRedirects: 5,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'nl-BE,nl;q=0.9,en-US,en;q=0.8,fr;q=0.5',
                },
                validateStatus: () => true,
            });

            const statusCode = response.status;

            // Definitive 404/410 — dead link
            if (statusCode === 404 || statusCode === 410) {
                return { isActive: false, statusCode, reason: `HTTP ${statusCode}`, error: null };
            }

            // Rate-limited or forbidden — skip, do not mark inactive
            if (statusCode === 403 || statusCode === 429) {
                return { isActive: true, statusCode, reason: 'Rate limited / forbidden', error: `HTTP ${statusCode}` };
            }

            // Server errors — uncertain, keep
            if (statusCode >= 500) {
                return { isActive: true, statusCode, reason: 'Server error', error: `HTTP ${statusCode}` };
            }

            // Detect homepage redirect (expired job → root / generic listing)
            const finalUrl = response.request?.res?.responseUrl;
            if (finalUrl && finalUrl !== url) {
                const redirectResult = this._analyzeRedirect(url, finalUrl, statusCode);
                if (redirectResult) return redirectResult;
            }

            // Scan visible page text for expiration phrases
            if (response.data && typeof response.data === 'string') {
                const $ = cheerio.load(response.data);
                $('script, style, noscript').remove();
                const pageText = $.text().replace(/\s+/g, ' ').toLowerCase().trim();

                for (const pattern of INACTIVE_TEXT_PATTERNS) {
                    if (pageText.includes(pattern)) {
                        return { isActive: false, statusCode, reason: `Text: "${pattern}"`, error: null };
                    }
                }
            }

            return { isActive: true, statusCode, reason: 'Active', error: null };

        } catch (error) {
            const errMsg = (
                error.code === 'ECONNABORTED' ||
                error.code === 'ETIMEDOUT' ||
                error.code === 'ERR_CANCELED'
            ) ? 'Timeout' : error.message;
            return { isActive: true, statusCode: null, reason: 'Network error', error: errMsg };
        }
    }

    /**
     * Check with retry on pure network errors (no HTTP response received).
     */
    async checkVacancyActivityWithRetry(vacancy) {
        let lastResult = null;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            lastResult = await this.checkVacancyActivity(vacancy);

            // Got a response (any HTTP status) or a deliberate skip → no retry needed
            if (lastResult.statusCode !== null || !lastResult.error) {
                return lastResult;
            }

            // Pure network error — wait then retry
            if (attempt < MAX_RETRIES) {
                await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
            }
        }

        return lastResult;
    }

    async getTodaysDeletionCount() {
        const today = new Date().toISOString().split('T')[0];
        const result = await query(
            `SELECT deletions_count FROM cleanup_daily_stats WHERE cleanup_date = $1`,
            [today]
        );
        return result.rows.length > 0 ? result.rows[0].deletions_count : 0;
    }

    async markVacancyInactive(vacancyId) {
        await query(
            `UPDATE vacancies SET is_active = false, updated_at = NOW() WHERE id = $1`,
            [vacancyId]
        );
    }

    async markVacancyChecked(vacancyId) {
        await query(
            `UPDATE vacancies SET last_cleanup_check = NOW() WHERE id = $1`,
            [vacancyId]
        );
    }

    async logCleanupAction(vacancy, action, httpStatus, reason) {
        await query(
            `INSERT INTO vacancy_cleanup_log
             (vacancy_id, vacancy_title, vacancy_source, vacancy_source_url, action, http_status, reason)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                vacancy.id,
                vacancy.title?.substring(0, 500),
                vacancy.source,
                vacancy.source_url,
                action,
                httpStatus,
                reason,
            ]
        );
    }

    async incrementDeletionCount() {
        const today = new Date().toISOString().split('T')[0];
        await query(
            `INSERT INTO cleanup_daily_stats (cleanup_date, deletions_count)
             VALUES ($1, 1)
             ON CONFLICT (cleanup_date)
             DO UPDATE SET
                deletions_count = cleanup_daily_stats.deletions_count + 1,
                updated_at = CURRENT_TIMESTAMP`,
            [today]
        );
    }

    async incrementCheckCount() {
        const today = new Date().toISOString().split('T')[0];
        await query(
            `INSERT INTO cleanup_daily_stats (cleanup_date, checks_count)
             VALUES ($1, 1)
             ON CONFLICT (cleanup_date)
             DO UPDATE SET
                checks_count = cleanup_daily_stats.checks_count + 1,
                updated_at = CURRENT_TIMESTAMP`,
            [today]
        );
    }

    /**
     * Check one vacancy and apply DB changes. Called concurrently.
     */
    async _processVacancy(vacancy, maxDeletions, stats) {
        stats.checked++;
        await this.incrementCheckCount();

        try {
            const result = await this.checkVacancyActivityWithRetry(vacancy);
            await this.markVacancyChecked(vacancy.id);

            if (!result.isActive) {
                // Re-check daily cap before deleting (guards against concurrent over-deletion)
                const deletionsNow = await this.getTodaysDeletionCount();
                if (deletionsNow >= maxDeletions) {
                    stats.limitReached = true;
                    return;
                }

                await this.markVacancyInactive(vacancy.id);
                await this.incrementDeletionCount();
                await this.logCleanupAction(vacancy, 'deleted', result.statusCode, result.reason || 'Confirmed inactive');
                stats.deleted++;
                console.log(`[Cleanup] ❌ Deactivated: "${vacancy.title}" — ${result.reason}`);
            } else {
                await this.logCleanupAction(
                    vacancy, 'checked_active', result.statusCode,
                    result.error || result.reason || 'Still active'
                );
                if (result.error) {
                    stats.errors++;
                    console.log(`[Cleanup] ⚠️  Kept (${result.error}): "${vacancy.title}"`);
                } else {
                    console.log(`[Cleanup] ✅ Active (HTTP ${result.statusCode}): "${vacancy.title}"`);
                }
            }
        } catch (error) {
            stats.errors++;
            try { await this.logCleanupAction(vacancy, 'error', null, error.message); } catch { /* ignore log failure */ }
            console.error(`[Cleanup] Error checking "${vacancy.title}":`, error.message);
        }
    }

    /**
     * Run the cleanup process with concurrent batch execution.
     * Returns: { checked, deleted, errors, skipped, limitReached }
     */
    async runDailyCleanup(maxDeletions = MAX_DELETIONS_PER_DAY) {
        const stats = { checked: 0, deleted: 0, errors: 0, skipped: 0, limitReached: false };

        const currentDeletions = await this.getTodaysDeletionCount();
        if (currentDeletions >= maxDeletions) {
            console.log(`[Cleanup] Daily limit already reached (${currentDeletions}/${maxDeletions})`);
            stats.limitReached = true;
            return stats;
        }

        const remainingDeletions = maxDeletions - currentDeletions;
        console.log(`[Cleanup] Starting — remaining deletions allowed: ${remainingDeletions}`);

        const candidates = await this.getStaleVacancies(remainingDeletions * 4);
        const totalBatches = Math.ceil(candidates.length / CONCURRENCY);
        console.log(`[Cleanup] ${candidates.length} stale candidates — ${CONCURRENCY} concurrent, ${totalBatches} batches`);

        for (let i = 0; i < candidates.length; i += CONCURRENCY) {
            if (stats.limitReached) break;

            // Pre-batch limit check
            const deletionsNow = await this.getTodaysDeletionCount();
            if (deletionsNow >= maxDeletions) {
                stats.limitReached = true;
                console.log(`[Cleanup] Daily limit reached (${deletionsNow}/${maxDeletions})`);
                break;
            }

            const batch = candidates.slice(i, i + CONCURRENCY);
            const batchNum = Math.floor(i / CONCURRENCY) + 1;
            console.log(`[Cleanup] Batch ${batchNum}/${totalBatches} (${batch.length} vacancies)...`);

            await Promise.all(batch.map(v => this._processVacancy(v, maxDeletions, stats)));

            if (i + CONCURRENCY < candidates.length && !stats.limitReached) {
                await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
            }
        }

        const successRate = stats.checked > 0
            ? (((stats.checked - stats.errors) / stats.checked) * 100).toFixed(1)
            : '0.0';
        console.log(
            `[Cleanup] Complete — checked: ${stats.checked}, deactivated: ${stats.deleted}, ` +
            `errors: ${stats.errors}, success rate: ${successRate}%`
        );
        return stats;
    }

    async getCleanupStats() {
        const today = new Date().toISOString().split('T')[0];

        const [todayResult, weekResult, staleResult, totalResult] = await Promise.all([
            query(`SELECT * FROM cleanup_daily_stats WHERE cleanup_date = $1`, [today]),
            query(
                `SELECT SUM(deletions_count) AS total_deletions,
                        SUM(checks_count)    AS total_checks,
                        SUM(errors_count)    AS total_errors
                 FROM cleanup_daily_stats
                 WHERE cleanup_date >= NOW() - INTERVAL '7 days'`
            ),
            query(
                `SELECT COUNT(*) AS stale_count
                 FROM vacancies
                 WHERE is_active = true
                   AND (last_cleanup_check IS NULL
                        OR last_cleanup_check < NOW() - INTERVAL '${CHECK_INTERVAL_DAYS} days')`
            ),
            query(`SELECT COUNT(*) AS total_active FROM vacancies WHERE is_active = true`),
        ]);

        return {
            today: todayResult.rows[0] || { deletions_count: 0, checks_count: 0 },
            lastWeek: weekResult.rows[0],
            staleVacancies: parseInt(staleResult.rows[0].stale_count),
            totalActiveVacancies: parseInt(totalResult.rows[0].total_active),
            maxDeletionsPerDay: MAX_DELETIONS_PER_DAY,
            checkIntervalDays: CHECK_INTERVAL_DAYS,
        };
    }

    async getRecentLogs(limit = 50) {
        const result = await query(
            `SELECT * FROM vacancy_cleanup_log ORDER BY created_at DESC LIMIT $1`,
            [limit]
        );
        return result.rows;
    }
}

module.exports = new VacancyCleanupService();
