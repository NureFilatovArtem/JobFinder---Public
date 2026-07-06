/**
 * Backfill categories for all existing vacancies.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');
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
        const rows = await client.query(
            `SELECT id, title, description FROM vacancies WHERE categories IS NULL ORDER BY id`
        );
        console.log(`Vacancies to classify: ${rows.rows.length}\n`);

        let classified = 0;
        let uncategorized = 0;

        for (const row of rows.rows) {
            const cats = classifyVacancy(row.title, row.description);
            if (cats.length > 0) {
                await client.query(`UPDATE vacancies SET categories = $1 WHERE id = $2`, [cats, row.id]);
                classified++;
            } else {
                uncategorized++;
            }
        }

        console.log(`✅ Classified: ${classified}`);
        console.log(`⚪ Uncategorized: ${uncategorized}\n`);

        // Show distribution
        const dist = await client.query(
            `SELECT unnest(categories) as cat, COUNT(*) as cnt FROM vacancies WHERE categories IS NOT NULL GROUP BY cat ORDER BY cnt DESC`
        );
        console.log('Category distribution:');
        for (const r of dist.rows) {
            console.log(`  ${r.cat}: ${r.cnt}`);
        }
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch(e => { console.error(e); process.exit(1); });
