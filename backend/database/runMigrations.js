/**
 * Automatic migration runner.
 *
 * Runs at server startup. Numbered migration files (NNN_name.sql) in
 * ./migrations are applied in order, exactly once each, inside a transaction.
 * Applied files are recorded in the `schema_migrations` table.
 *
 * SAFETY: this is invoked only by the Node process during initializeDatabase().
 * It is never wired to an HTTP route, so it is not reachable by end users —
 * only by whoever can start/deploy the backend.
 *
 * FIRST RUN: the database already reflects migrations 001–015 (applied
 * manually). To avoid re-running them, the first time this runs it "baselines"
 * — it records every existing numbered migration as already applied. From then
 * on, only NEW migration files (016+) are applied automatically.
 */
const fs = require('fs');
const path = require('path');
const { pool } = require('./postgres');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function runMigrations() {
  const client = await pool.connect();
  try {
    // Has the tracking table ever existed? (determines first-run baseline)
    const exists = await client.query("SELECT to_regclass('public.schema_migrations') AS t");
    const firstRun = !exists.rows[0].t;

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Only auto-run strictly numbered migrations (e.g. 016_xyz.sql), sorted.
    // Un-numbered legacy files (add_*.sql, fix_*.sql) are ignored on purpose.
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => /^\d+_.*\.sql$/i.test(f))
      .sort();

    if (firstRun) {
      for (const f of files) {
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
          [f]
        );
      }
      console.log(
        `[Migrations] Baselined ${files.length} existing migrations. ` +
          `New migration files will now auto-apply on startup.`
      );
      return;
    }

    const appliedRes = await client.query('SELECT filename FROM schema_migrations');
    const applied = new Set(appliedRes.rows.map((r) => r.filename));
    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log('[Migrations] Database schema is up to date.');
      return;
    }

    for (const f of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
      console.log(`[Migrations] Applying ${f} ...`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
        await client.query('COMMIT');
        console.log(`[Migrations] ✅ ${f} applied.`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[Migrations] ❌ ${f} failed: ${err.message}`);
        throw err; // abort startup — a half-migrated DB is worse than a clear stop
      }
    }
  } finally {
    client.release();
  }
}

module.exports = { runMigrations };
