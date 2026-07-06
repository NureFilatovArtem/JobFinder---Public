/**
 * SQLite to PostgreSQL Migration Script
 * Migrates all data from SQLite database to PostgreSQL
 */

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { query } = require('./postgres');

const SQLITE_DB_PATH = process.env.DATABASE_URL || './jobfinder.db';

async function migrate() {
    console.log('🔄 Starting migration from SQLite to PostgreSQL...\n');

    // Open SQLite database
    const sqliteDb = new sqlite3.Database(SQLITE_DB_PATH, (err) => {
        if (err) {
            console.error('❌ Error opening SQLite database:', err);
            process.exit(1);
        }
        console.log('✅ Connected to SQLite database');
    });

    try {
        // Migrate Vacancies
        console.log('\n📦 Migrating vacancies...');
        const vacancies = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM vacancies', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        console.log(`Found ${vacancies.length} vacancies to migrate`);

        for (const vac of vacancies) {
            await query(
                `INSERT INTO vacancies 
         (title, company, location, postcode, description, contract_type, 
          salary, job_type, source_site, link, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT DO NOTHING`,
                [
                    vac.title,
                    vac.company,
                    vac.location,
                    vac.postcode,
                    vac.description,
                    vac.contract_type || null,
                    vac.salary || null,
                    vac.job_type,
                    vac.source || 'legacy',
                    vac.link,
                    vac.status || 'gevonden',
                    vac.created_at || new Date()
                ]
            );
        }
        console.log('✅ Vacancies migrated successfully');

        // Migrate Profile to Users
        console.log('\n👤 Migrating profile to users...');
        const profile = await new Promise((resolve, reject) => {
            sqliteDb.get('SELECT * FROM profile WHERE id = 1', (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (profile) {
            // Parse skills from comma-separated string to array
            const skills = profile.skills ? profile.skills.split(',').map(s => s.trim()) : [];
            const languages = profile.languages ? profile.languages.split(',').map(l => l.trim()) : [];

            await query(
                `INSERT INTO users 
         (email, name, skills, languages, experience_years, preferred_locations)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email) DO UPDATE SET
           name = EXCLUDED.name,
           skills = EXCLUDED.skills,
           languages = EXCLUDED.languages`,
                [
                    'default@jobfinder.local',
                    profile.name || '',
                    skills,
                    languages || [],
                    0,
                    []
                ]
            );
            console.log('✅ Profile migrated to users table');
        }

        // Get country ID for Belgium (default for legacy data)
        const belgiumResult = await query(
            "SELECT id FROM countries WHERE code = 'BE'"
        );
        const belgiumId = belgiumResult.rows[0]?.id;

        if (belgiumId) {
            // Update vacancies with default country
            const antwerpenResult = await query(
                "SELECT id FROM cities WHERE name = 'Antwerpen' AND country_id = $1",
                [belgiumId]
            );

            if (antwerpenResult.rows.length === 0) {
                // Create Antwerpen city if it doesn't exist
                await query(
                    "INSERT INTO cities (country_id, name, latitude, longitude) VALUES ($1, 'Antwerpen', 51.2194, 4.4025)",
                    [belgiumId]
                );
            }

            // Update vacancies without country_id
            await query(
                "UPDATE vacancies SET country_id = $1 WHERE country_id IS NULL",
                [belgiumId]
            );
            console.log('✅ Updated vacancies with default country (Belgium)');
        }

        console.log('\n✨ Migration completed successfully!');
        console.log('\nNext steps:');
        console.log('1. Verify data in PostgreSQL');
        console.log('2. Update DATABASE_TYPE=postgres in .env');
        console.log('3. Restart the server');
        console.log('4. Test all functionality');

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        throw error;
    } finally {
        sqliteDb.close();
        process.exit(0);
    }
}

// Run migration
migrate().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
