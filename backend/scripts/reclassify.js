/** Reclassify all vacancies with latest category definitions + employment type */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const { classifyVacancy, detectEmploymentType } = require('../config/jobCategories');

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
        const rows = await client.query('SELECT id, title, description FROM vacancies ORDER BY id');
        console.log('Total vacancies:', rows.rows.length);

        let classified = 0;
        let typed = 0;
        const empDist = {};

        for (const row of rows.rows) {
            const cats = classifyVacancy(row.title, row.description);
            const empType = detectEmploymentType(row.title, row.description);

            await client.query(
                'UPDATE vacancies SET categories = $1, employment_type = $2 WHERE id = $3',
                [cats.length > 0 ? cats : null, empType, row.id]
            );

            if (cats.length > 0) classified++;
            if (empType) {
                typed++;
                empDist[empType] = (empDist[empType] || 0) + 1;
            }
        }

        console.log('\nClassified:', classified, '/', rows.rows.length);
        console.log('Employment typed:', typed, '/', rows.rows.length);

        // Category distribution
        const catDist = await client.query(
            `SELECT unnest(categories) as cat, COUNT(*) as cnt
             FROM vacancies WHERE categories IS NOT NULL
             GROUP BY cat ORDER BY cnt DESC`
        );
        console.log('\nCategory distribution:');
        for (const r of catDist.rows) {
            console.log(' ', r.cat + ':', r.cnt);
        }

        // Employment type distribution
        console.log('\nEmployment type distribution:');
        for (const [type, count] of Object.entries(empDist).sort((a, b) => b[1] - a[1])) {
            console.log(' ', type + ':', count);
        }
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch(e => { console.error(e); process.exit(1); });
