/**
 * Database Abstraction Layer
 * Provides unified interface for both SQLite and PostgreSQL
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DATABASE_TYPE = process.env.DATABASE_TYPE || 'sqlite';
console.log(`📦 DATABASE_TYPE from env: "${process.env.DATABASE_TYPE}" -> using: "${DATABASE_TYPE}"`);

let db, dbHelpers;

if (DATABASE_TYPE === 'postgres') {
    // Use PostgreSQL with new v2 schema
    console.log('🐘 Using PostgreSQL database (Schema v2)');
    const postgres = require('./postgres');
    const postgresHelpers = require('./postgresHelpers_v2');

    db = {
        initializeDatabase: postgres.initializeDatabase,
        checkConnection: postgres.checkConnection,
        query: postgres.query,
        getClient: postgres.getClient,
        pool: postgres.pool,
        closePool: postgres.closePool
    };

    // postgresHelpers_v2 exports dbHelpers directly
    dbHelpers = postgresHelpers;

} else {
    // Use SQLite (legacy)
    console.log('💾 Using SQLite database');
    const sqlite = require('../db');

    // Create a PostgreSQL-compatible query wrapper for SQLite
    const sqliteQuery = async (sql, params = []) => {
        const database = await sqlite.getDatabase();

        // Convert PostgreSQL-style $1, $2 placeholders to SQLite ? placeholders
        let sqliteSQL = sql;
        let paramIndex = 1;
        while (sqliteSQL.includes(`$${paramIndex}`)) {
            sqliteSQL = sqliteSQL.replace(`$${paramIndex}`, '?');
            paramIndex++;
        }

        // Convert PostgreSQL-specific syntax to SQLite equivalents
        sqliteSQL = sqliteSQL
            .replace(/CURRENT_TIMESTAMP/gi, "datetime('now')")
            .replace(/RETURNING\s+.*/gi, '') // SQLite doesn't support RETURNING in older versions
            .replace(/FOR UPDATE SKIP LOCKED/gi, '')
            .replace(/ON CONFLICT\s*\([^)]+\)\s*DO NOTHING/gi, 'OR IGNORE')
            .replace(/= ANY\(\?\)/gi, 'IN (SELECT value FROM json_each(?))');

        // Handle FILTER syntax (PostgreSQL aggregate filters)
        sqliteSQL = sqliteSQL.replace(
            /COUNT\(\*\)\s+FILTER\s*\(\s*WHERE\s+status\s*=\s*'(\w+)'\s*\)\s+as\s+(\w+)/gi,
            "SUM(CASE WHEN status = '$1' THEN 1 ELSE 0 END) as $2"
        );

        return new Promise((resolve, reject) => {
            // Determine if this is a SELECT (returns rows) or other statement
            const isSelect = sqliteSQL.trim().toUpperCase().startsWith('SELECT');
            const isInsert = sqliteSQL.trim().toUpperCase().startsWith('INSERT');
            const isUpdate = sqliteSQL.trim().toUpperCase().startsWith('UPDATE');

            if (isSelect) {
                database.all(sqliteSQL, params, (err, rows) => {
                    database.close();
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ rows: rows || [] });
                    }
                });
            } else {
                database.run(sqliteSQL, params, function (err) {
                    database.close();
                    if (err) {
                        reject(err);
                    } else {
                        // For INSERT/UPDATE, return affected info in rows format
                        resolve({
                            rows: isInsert ? [{ id: this.lastID }] : [],
                            rowCount: this.changes
                        });
                    }
                });
            }
        });
    };

    db = {
        initializeDatabase: sqlite.initializeDatabase,
        getDatabase: sqlite.getDatabase,
        query: sqliteQuery,
    };

    dbHelpers = sqlite.dbHelpers;
}

module.exports = {
    db,
    dbHelpers,
    DATABASE_TYPE
};
