/**
 * Backfill & Dedup Enforcement Script
 * 
 * Safe rollout phases:
 *   Phase 1: Backfill normalized columns + dedup_key for existing rows (JS normalizer)
 *   Phase 2: Detect and clean remaining duplicate groups
 *   Phase 3: Create UNIQUE index on dedup_key
 *   Phase 4: Verify integrity
 * 
 * Usage: node scripts/backfillDedup.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const {
    normalizeDedupField,
    normalizeCity,
    generateSafeDedupKey,
    generateSourceId,
    hasEnoughDataForBusinessDedup
} = require('../services/vacancyNormalizer');
const { classifyVacancy } = require('../config/jobCategories');

const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'JobFinder',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || ''
});

async function main() {
    const client = await pool.connect();

    try {
        // ============================================
        // PHASE 1: Backfill normalized columns
        // ============================================
        console.log('\n=== PHASE 1: Backfilling normalized columns ===\n');

        // Get all rows that need backfill
        const allRows = await client.query(
            `SELECT id, source, source_id, source_url, title, company_name, location_text
             FROM vacancies 
             WHERE dedup_key IS NULL
             ORDER BY id`
        );

        console.log(`Rows to backfill: ${allRows.rows.length}`);

        let backfilled = 0;
        for (const row of allRows.rows) {
            const titleNormalized = normalizeDedupField(row.title);
            const companyNormalized = normalizeDedupField(row.company_name || '');
            const cityNormalized = normalizeCity(row.location_text || '');
            const dedupKey = generateSafeDedupKey({
                source: row.source,
                title: row.title,
                company: row.company_name || '',
                location: row.location_text || '',
                source_url: row.source_url,
                link: row.source_url
            });

            // Generate a deterministic source_id to replace old timestamp-based ones
            const newSourceId = generateSourceId({
                source: row.source,
                source_id: null, // Force regeneration
                source_url: row.source_url,
                title: row.title,
                company: row.company_name,
                location: row.location_text,
                link: row.source_url
            });

            // Classify into categories
            const categories = classifyVacancy(row.title, null);

            await client.query(
                `UPDATE vacancies SET
                    title_normalized = $1,
                    company_normalized = $2,
                    city_normalized = $3,
                    dedup_key = $4,
                    source_id = $5,
                    categories = $6
                 WHERE id = $7`,
                [
                    titleNormalized,
                    companyNormalized,
                    cityNormalized,
                    dedupKey,
                    newSourceId,
                    categories.length > 0 ? categories : null,
                    row.id
                ]
            );

            backfilled++;
            if (backfilled % 500 === 0) {
                console.log(`  Backfilled ${backfilled}/${allRows.rows.length}...`);
            }
        }

        console.log(`✅ Backfilled ${backfilled} rows\n`);

        // ============================================
        // PHASE 2: Detect and clean duplicate groups
        // ============================================
        console.log('=== PHASE 2: Detecting duplicate groups ===\n');

        const dupes = await client.query(`
            SELECT dedup_key, COUNT(*) as cnt,
                   MIN(id) as keep_id,
                   ARRAY_AGG(id ORDER BY id) as all_ids,
                   MIN(title) as sample_title,
                   MIN(company_name) as sample_company,
                   MIN(location_text) as sample_location
            FROM vacancies
            WHERE dedup_key IS NOT NULL
            GROUP BY dedup_key
            HAVING COUNT(*) > 1
            ORDER BY COUNT(*) DESC
        `);

        console.log(`Found ${dupes.rows.length} duplicate groups\n`);

        if (dupes.rows.length > 0) {
            // Show top 10 duplicate groups
            console.log('Top duplicate groups:');
            for (const group of dupes.rows.slice(0, 10)) {
                console.log(`  [${group.cnt}x] "${group.sample_title}" | "${group.sample_company}" | "${group.sample_location}" | keep ID=${group.keep_id}`);
            }

            // Collect IDs to delete (keep the one with lowest id = oldest)
            const idsToDelete = [];
            for (const group of dupes.rows) {
                // Keep the first (oldest) ID, delete the rest
                const toDelete = group.all_ids.filter(id => id !== group.keep_id);
                idsToDelete.push(...toDelete);
            }

            console.log(`\nTotal duplicate rows to delete: ${idsToDelete.length}`);

            if (idsToDelete.length > 0) {
                // Migrate user interactions to kept records
                console.log('\nMigrating user interactions...');

                for (const group of dupes.rows) {
                    const keepId = group.keep_id;
                    const deleteIds = group.all_ids.filter(id => id !== keepId);
                    if (deleteIds.length === 0) continue;

                    const placeholders = deleteIds.map((_, i) => `$${i + 2}`).join(', ');

                    // Migrate user_vacancy_scores
                    await client.query(
                        `UPDATE user_vacancy_scores SET vacancy_id = $1 
                         WHERE vacancy_id IN (${placeholders})
                         AND NOT EXISTS (
                             SELECT 1 FROM user_vacancy_scores 
                             WHERE vacancy_id = $1 AND user_id = user_vacancy_scores.user_id
                         )`,
                        [keepId, ...deleteIds]
                    );

                    // Clean orphaned scores
                    await client.query(
                        `DELETE FROM user_vacancy_scores WHERE vacancy_id IN (${placeholders})`,
                        deleteIds
                    );

                    // Clean auto_apply_queue
                    await client.query(
                        `DELETE FROM auto_apply_queue WHERE vacancy_id IN (${placeholders})`,
                        deleteIds
                    );

                    // Clean interaction logs
                    await client.query(
                        `DELETE FROM user_vacancy_interactions WHERE vacancy_id IN (${placeholders})`,
                        deleteIds
                    );
                }

                // Delete duplicate vacancies in batches
                const BATCH_SIZE = 200;
                let deleted = 0;
                for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
                    const batch = idsToDelete.slice(i, i + BATCH_SIZE);
                    const placeholders = batch.map((_, j) => `$${j + 1}`).join(', ');
                    await client.query(
                        `DELETE FROM vacancies WHERE id IN (${placeholders})`,
                        batch
                    );
                    deleted += batch.length;
                    if (deleted % 500 === 0) {
                        console.log(`  Deleted ${deleted}/${idsToDelete.length}...`);
                    }
                }

                console.log(`✅ Deleted ${deleted} duplicate vacancies`);
            }
        } else {
            console.log('✅ No duplicates found — data is clean\n');
        }

        // ============================================
        // PHASE 3: Create UNIQUE index on dedup_key
        // ============================================
        console.log('\n=== PHASE 3: Creating UNIQUE index on dedup_key ===\n');

        try {
            await client.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS idx_vacancies_dedup_key 
                ON vacancies (dedup_key)
                WHERE dedup_key IS NOT NULL
            `);
            console.log('✅ UNIQUE index idx_vacancies_dedup_key created successfully\n');
        } catch (error) {
            console.error('❌ Failed to create unique index:', error.message);
            console.error('   This likely means there are still duplicate dedup_keys.');
            console.error('   Investigating...');

            // Find remaining conflicts
            const conflicts = await client.query(`
                SELECT dedup_key, COUNT(*), ARRAY_AGG(id ORDER BY id) as ids
                FROM vacancies 
                WHERE dedup_key IS NOT NULL
                GROUP BY dedup_key 
                HAVING COUNT(*) > 1 
                LIMIT 5
            `);
            for (const c of conflicts.rows) {
                console.error(`   dedup_key=${c.dedup_key}, ids=${c.ids}`);
            }
            throw error;
        }

        // ============================================
        // PHASE 4: Verification
        // ============================================
        console.log('=== PHASE 4: Verification ===\n');

        const total = await client.query('SELECT COUNT(*) as cnt FROM vacancies');
        const withDedup = await client.query('SELECT COUNT(*) as cnt FROM vacancies WHERE dedup_key IS NOT NULL');
        const withCategories = await client.query('SELECT COUNT(*) as cnt FROM vacancies WHERE categories IS NOT NULL AND array_length(categories, 1) > 0');
        const uniqueKeys = await client.query('SELECT COUNT(DISTINCT dedup_key) as cnt FROM vacancies WHERE dedup_key IS NOT NULL');
        const dupCheck = await client.query('SELECT dedup_key, COUNT(*) as cnt FROM vacancies WHERE dedup_key IS NOT NULL GROUP BY dedup_key HAVING COUNT(*) > 1');

        console.log(`Total vacancies:     ${total.rows[0].cnt}`);
        console.log(`With dedup_key:      ${withDedup.rows[0].cnt}`);
        console.log(`Unique dedup_keys:   ${uniqueKeys.rows[0].cnt}`);
        console.log(`With categories:     ${withCategories.rows[0].cnt}`);
        console.log(`Duplicate groups:    ${dupCheck.rows.length}`);

        // Category distribution
        const catDist = await client.query(`
            SELECT unnest(categories) as cat, COUNT(*) as cnt
            FROM vacancies
            WHERE categories IS NOT NULL
            GROUP BY cat
            ORDER BY cnt DESC
        `);
        console.log('\nCategory distribution:');
        for (const row of catDist.rows) {
            console.log(`  ${row.cat}: ${row.cnt}`);
        }

        // Sample normalized data
        const sample = await client.query(`
            SELECT id, title_normalized, company_normalized, city_normalized,
                   LEFT(dedup_key, 12) as dedup_prefix, categories
            FROM vacancies ORDER BY id LIMIT 10
        `);
        console.log('\nSample normalized data:');
        for (const row of sample.rows) {
            console.log(`  ID=${row.id} | "${row.title_normalized}" | "${row.company_normalized}" | "${row.city_normalized}" | key=${row.dedup_prefix}... | cats=${JSON.stringify(row.categories)}`);
        }

        if (dupCheck.rows.length === 0) {
            console.log('\n🎉 All phases complete. Dedup system is fully operational!');
        } else {
            console.log('\n⚠️  WARNING: Some duplicate groups remain!');
        }

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
