/**
 * Feature Flag Service
 *
 * Provides cached read/write access to the feature_flags table.
 */

const { db } = require('../database');

// ================================================================
// In-memory feature flag cache with TTL.
//
// NOTE: This cache is per-instance only.
// In multi-instance deployments (horizontal scaling),
// this must be replaced with a shared cache (e.g., Redis).
// ================================================================
const cache = new Map();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

/**
 * Get a feature flag value (cached).
 * Returns false if the key does not exist.
 *
 * @param {string} key
 * @returns {Promise<boolean>}
 */
async function getFeatureFlag(key) {
    const cached = cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
        return cached.value;
    }

    const result = await db.query(
        'SELECT value FROM feature_flags WHERE key = $1',
        [key]
    );

    const value = result.rows.length > 0 ? result.rows[0].value : false;
    cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
}

/**
 * Set a feature flag value (upsert). Invalidates cache immediately.
 *
 * @param {string} key
 * @param {boolean} value
 */
async function setFeatureFlag(key, value) {
    // TODO: Audit logging — record who toggled this flag and when.
    //       e.g., INSERT INTO audit_log (user_id, action, key, old_value, new_value, timestamp)
    await db.query(
        `INSERT INTO feature_flags (key, value, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
        [key, value]
    );

    // Invalidate cache immediately on write
    cache.delete(key);
}

module.exports = { getFeatureFlag, setFeatureFlag };
