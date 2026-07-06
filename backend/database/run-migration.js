/**
 * One-off migration runner.
 * Usage: node database/run-migration.js migrations/015_multiple_gmail_accounts.sql
 */
const fs = require('fs');
const path = require('path');
const { pool, closePool } = require('./postgres');

async function run() {
  const rel = process.argv[2];
  if (!rel) {
    console.error('Usage: node database/run-migration.js <path-to-sql>');
    process.exit(1);
  }
  const file = path.isAbsolute(rel) ? rel : path.join(__dirname, '..', rel);
  const sql = fs.readFileSync(file, 'utf8');
  console.log(`Applying migration: ${file}`);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration applied successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await closePool();
  }
}

run();
