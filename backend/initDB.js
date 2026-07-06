// Script to initialize PostgreSQL database schema
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'JobFinder',
    user: process.env.DB_ADMIN || 'postgres',
    password: process.env.DB_PASSWORD
});

async function initDatabase() {
    const client = await pool.connect();

    try {
        console.log('🔄 Reading schema.sql...');
        const schemaPath = path.join(__dirname, 'database', 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        console.log('🔄 Executing schema...');
        await client.query(schema);

        console.log('✅ Database schema initialized successfully!');

        // Verify tables
        const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

        console.log('\n📊 Created tables:');
        result.rows.forEach(row => {
            console.log(`   ✓ ${row.table_name}`);
        });

    } catch (error) {
        console.error('❌ Error initializing database:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

initDatabase()
    .then(() => {
        console.log('\n✅ Database initialization complete!');
        process.exit(0);
    })
    .catch(err => {
        console.error('\n❌ Database initialization failed:', err);
        process.exit(1);
    });
