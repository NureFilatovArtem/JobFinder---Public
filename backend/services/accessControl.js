/**
 * Access Control Service
 *
 * Role checking and Auto Apply whitelist verification.
 * This is the single source of truth for role-based checks.
 */

const { db } = require('../database');

/**
 * Check if user has admin or owner role.
 * Safely handles missing/null role (defaults to 'user').
 *
 * @param {Object} user
 * @returns {boolean}
 */
function isAdminOrOwner(user) {
    const role = user?.role || 'user';
    return role === 'admin' || role === 'owner';
}

/**
 * Check if user has Auto Apply access.
 * Access is granted if:
 *   - user.role === 'owner'
 *   - user.role === 'admin'
 *   - user.id exists in auto_apply_access whitelist
 *
 * @param {Object} user - Must have at least { id, role }
 * @returns {Promise<boolean>}
 */
async function hasAutoApplyAccess(user) {
    if (!user?.id) return false;

    // Admin/owner always have access
    if (isAdminOrOwner(user)) return true;

    // Check whitelist
    const result = await db.query(
        'SELECT 1 FROM auto_apply_access WHERE user_id = $1',
        [user.id]
    );

    return result.rows.length > 0;
}

module.exports = { isAdminOrOwner, hasAutoApplyAccess };
