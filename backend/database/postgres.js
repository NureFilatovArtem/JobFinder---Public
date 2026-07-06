/**
 * PostgreSQL Database Connection
 * Handles connection pooling and database operations
 */

const { Pool } = require('pg');
require('dotenv').config();

// Create connection pool - support multiple env variable formats
const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || process.env.DB_PORT || 5432,
    database: process.env.POSTGRES_DB || process.env.DB_NAME || 'jobfinder',
    user: process.env.POSTGRES_USER || process.env.DB_ADMIN || 'postgres',
    password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test connection
pool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle PostgreSQL client', err);
    process.exit(-1);
});

/**
 * Execute a query
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise} Query result
 */
const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        // Only log slow queries to reduce noise
        if (duration > 100) {
            console.log('Slow query', { duration, rows: res.rowCount });
        }
        return res;
    } catch (error) {
        console.error('Query error:', error.message);
        throw error;
    }
};

/**
 * Get a client from the pool for transactions
 * @returns {Promise} Database client
 */
const getClient = async () => {
    const client = await pool.connect();
    const originalQuery = client.query;
    const originalRelease = client.release;

    // Set a timeout for client checkout
    const timeout = setTimeout(() => {
        console.error('A client has been checked out for more than 5 seconds!');
    }, 5000);

    // Monkey patch the query method to track execution time
    client.query = (...args) => {
        return originalQuery.apply(client, args);
    };

    // Monkey patch the release method to clear the timeout
    client.release = () => {
        clearTimeout(timeout);
        client.query = originalQuery;
        client.release = originalRelease;
        return originalRelease.apply(client);
    };

    return client;
};

/**
 * Close the database pool
 */
const closePool = async () => {
    await pool.end();
    console.log('PostgreSQL pool closed');
};

/**
 * Initialize database (create tables if they don't exist)
 */
const initializeDatabase = async () => {
    try {
        console.log('Initializing PostgreSQL database...');
        // Verify connection
        await query('SELECT 1');
        // Apply any pending numbered migrations (required lazily to avoid a
        // circular dependency between this module and runMigrations.js).
        const { runMigrations } = require('./runMigrations');
        await runMigrations();
        console.log('✅ Database ready');
    } catch (error) {
        console.error('❌ Error initializing database:', error.message);
        throw error;
    }
};

/**
 * Check database connection
 */
const checkConnection = async () => {
    try {
        const result = await query('SELECT NOW()');
        console.log('Database connection OK:', result.rows[0].now);
        return true;
    } catch (error) {
        console.error('Database connection failed:', error.message);
        return false;
    }
};

module.exports = {
    query,
    getClient,
    pool,
    closePool,
    initializeDatabase,
    checkConnection
};
