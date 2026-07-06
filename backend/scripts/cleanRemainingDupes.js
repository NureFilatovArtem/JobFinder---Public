/**
 * Clean remaining duplicates that survived the backfill.
 * These are rows with the same dedup_key — keeps the oldest, deletes the rest.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');

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
        // 1. Diagnose: find all duplicate groups
        const dupes = await client.query(`
            SELECT dedup_key, COUNT(*) as cnt,
                   MIN(id) as keep_id,
                   ARRAY_AGG(id ORDER BY id) as all_ids,
                   MIN(title) as title,
                   MIN(company_name) as company,
                   MIN(location_text) as location
            FROM vacancies
            WHERE dedup_key IS NOT NULL
            GROUP BY dedup_key
            HAVING COUNT(*) > 1
            ORDER BY COUNT(*) DESC
        `);

        console.log(`\nFound ${dupes.rows.length} duplicate groups:\n`);

        let totalToDelete = 0;
        for (const g of dupes.rows) {
            const deleteCount = g.cnt - 1;
            totalToDelete += deleteCount;
            console.log(`  [${g.cnt}x] "${g.title}" | "${g.company}" | "${g.location}" → keep ID=${g.keep_id}, delete ${deleteCount}`);
        }

        if (totalToDelete === 0) {
            console.log('\n✅ No duplicates found!');
            return;
        }

        console.log(`\nTotal rows to delete: ${totalToDelete}\n`);

        // 2. Clean: delete duplicates keeping oldest
        for (const g of dupes.rows) {
            const deleteIds = g.all_ids.filter(id => id !== g.keep_id);
            if (deleteIds.length === 0) continue;

            const placeholders = deleteIds.map((_, i) => `$${i + 1}`).join(', ');

            // Migrate user scores
            for (const delId of deleteIds) {
                await client.query(
                    `UPDATE user_vacancy_scores SET vacancy_id = $1 
                     WHERE vacancy_id = $2
                     AND NOT EXISTS (SELECT 1 FROM user_vacancy_scores WHERE vacancy_id = $1 AND user_id = user_vacancy_scores.user_id)`,
                    [g.keep_id, delId]
                );
            }

            // Clean related tables
            await client.query(`DELETE FROM user_vacancy_scores WHERE vacancy_id IN (${placeholders})`, deleteIds);
            await client.query(`DELETE FROM auto_apply_queue WHERE vacancy_id IN (${placeholders})`, deleteIds);
            await client.query(`DELETE FROM user_vacancy_interactions WHERE vacancy_id IN (${placeholders})`, deleteIds);

            // Delete the duplicate vacancies
            await client.query(`DELETE FROM vacancies WHERE id IN (${placeholders})`, deleteIds);
        }

        console.log(`✅ Deleted ${totalToDelete} duplicate rows\n`);

        // 3. Verify
        const remaining = await client.query(`
            SELECT COUNT(*) as total,
                   COUNT(DISTINCT dedup_key) as unique_keys
            FROM vacancies WHERE dedup_key IS NOT NULL
        `);
        const stillDuped = await client.query(`
            SELECT COUNT(*) as cnt FROM (
                SELECT dedup_key FROM vacancies WHERE dedup_key IS NOT NULL GROUP BY dedup_key HAVING COUNT(*) > 1
            ) t
        `);

        console.log(`Total vacancies: ${remaining.rows[0].total}`);
        console.log(`Unique dedup_keys: ${remaining.rows[0].unique_keys}`);
        console.log(`Remaining duplicate groups: ${stillDuped.rows[0].cnt}`);

        // 4. Try to enforce unique index if not already there
        try {
            await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_vacancies_dedup_key ON vacancies (dedup_key) WHERE dedup_key IS NOT NULL`);
            console.log('\n✅ UNIQUE index on dedup_key is active');
        } catch (e) {
            console.error('\n❌ Could not create unique index:', e.message);
        }

    } finally {
        client.release();
        await pool.end();
    }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
