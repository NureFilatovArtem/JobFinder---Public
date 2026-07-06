/**
 * POST-MORTEM: Check what's left and understand what happened
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
        console.log('=== POST-MORTEM ANALYSIS ===\n');

        // 1. How many vacancies remain?
        const total = await client.query('SELECT COUNT(*) as cnt FROM vacancies');
        console.log(`Vacancies remaining: ${total.rows[0].cnt}\n`);

        // 2. Show distribution of location_text values
        console.log('--- location_text distribution ---');
        const locDist = await client.query(`
            SELECT 
                COALESCE(location_text, '<NULL>') as loc, 
                COUNT(*) as cnt 
            FROM vacancies 
            GROUP BY location_text 
            ORDER BY cnt DESC 
            LIMIT 30
        `);
        for (const row of locDist.rows) {
            console.log(`  [${row.cnt}] "${row.loc}"`);
        }

        // 3. Show distribution of city_id values
        console.log('\n--- city_id distribution ---');
        const cityDist = await client.query(`
            SELECT 
                v.city_id, 
                c.name as city_name, 
                COUNT(*) as cnt 
            FROM vacancies v
            LEFT JOIN cities c ON v.city_id = c.id
            GROUP BY v.city_id, c.name
            ORDER BY cnt DESC  
            LIMIT 20
        `);
        for (const row of cityDist.rows) {
            console.log(`  city_id=${row.city_id} (${row.city_name || 'NULL'}): ${row.cnt} vacancies`);
        }

        // 4. Check if Jobstudent marketing still exists
        console.log('\n--- "Jobstudent marketing" check ---');
        const jobstudent = await client.query(`
            SELECT id, title, company_name, location_text, city_id, source
            FROM vacancies WHERE title ILIKE '%jobstudent marketing%'
        `);
        console.log(`Found: ${jobstudent.rows.length}`);
        for (const row of jobstudent.rows) {
            console.log(`  ID=${row.id} | "${row.title}" | company="${row.company_name}" | loc="${row.location_text}" | city_id=${row.city_id}`);
        }

        // 5. Show some sample remaining vacancies
        console.log('\n--- 20 sample remaining vacancies ---');
        const sample = await client.query(`
            SELECT id, title, company_name, location_text, city_id, source
            FROM vacancies ORDER BY id LIMIT 20
        `);
        for (const row of sample.rows) {
            console.log(`  ID=${row.id} | "${row.title}" | "${row.company_name}" | loc="${row.location_text}" | city_id=${row.city_id} | ${row.source}`);
        }

        // 6. Check: were vacancies actually different (different city_id but same location_text)?
        console.log('\n--- Check: how many had same title+company but DIFFERENT city_id ---');
        const diffCity = await client.query(`
            SELECT title, company_name, 
                   COUNT(DISTINCT city_id) as unique_cities,
                   COUNT(*) as total,
                   ARRAY_AGG(DISTINCT city_id) as city_ids,
                   location_text
            FROM vacancies
            GROUP BY title, company_name, location_text
            HAVING COUNT(DISTINCT city_id) > 1
            ORDER BY COUNT(*) DESC
            LIMIT 10
        `);
        console.log(`Groups with same title+company+location_text but different city_ids: ${diffCity.rows.length}`);
        for (const row of diffCity.rows) {
            console.log(`  "${row.title}" | "${row.company_name}" | loc="${row.location_text}" | cities=${JSON.stringify(row.city_ids)} | total=${row.total}`);
        }

        // 7. The REAL question: before deletion, how many had SAME title+company but different locations?
        // We can't check deleted data, but we can check if the remaining ones are diverse
        console.log('\n--- Unique titles remaining ---');
        const uniqueTitles = await client.query(`
            SELECT COUNT(DISTINCT title) as unique_titles FROM vacancies
        `);
        console.log(`Unique titles: ${uniqueTitles.rows[0].unique_titles} out of ${total.rows[0].cnt} total`);

        // 8. Any duplicates still remaining?
        console.log('\n--- Any duplicates still remaining? ---');
        const remaining = await client.query(`
            SELECT title, company_name, location_text, COUNT(*) as cnt
            FROM vacancies
            GROUP BY title, company_name, location_text
            HAVING COUNT(*) > 1
            ORDER BY cnt DESC
            LIMIT 10
        `);
        console.log(`Duplicate groups remaining: ${remaining.rows.length}`);

    } catch (error) {
        console.error('ERROR:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
