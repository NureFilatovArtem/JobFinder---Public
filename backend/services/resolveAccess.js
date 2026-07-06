/**
 * Unified Access Resolver
 *
 * THE ONLY place where Auto Apply access decisions are made.
 * Used by autoApplyGate middleware for both JWT and session routes.
 * No other file should duplicate this logic.
 */

const { getFeatureFlag } = require('./featureFlags');
const { isAdminOrOwner, hasAutoApplyAccess } = require('./accessControl');

/**
 * Resolve whether a user has Auto Apply access.
 *
 * @param {Object} user - Must have at least { id, role }
 * @returns {Promise<{ allowed: boolean, reason?: string, errorCode?: string }>}
 */
async function resolveAutoApplyAccess(user) {
    if (!user?.id) {
        return { allowed: false, reason: 'Authentication required', errorCode: 'NOT_AUTHENTICATED' };
    }

    // --- Step 1: Feature flag check ---
    // NOTE:
    // Admin/owner bypass is intentional for testing and control.
    // If strict global disable is needed, remove this condition.
    const featureEnabled = await getFeatureFlag('auto_apply_enabled');
    if (!featureEnabled && !isAdminOrOwner(user)) {
        return { allowed: false, reason: 'Auto Apply is currently disabled', errorCode: 'FEATURE_DISABLED' };
    }

    // --- Step 2: Access control (role + whitelist) ---
    const hasAccess = await hasAutoApplyAccess(user);
    if (!hasAccess) {
        return { allowed: false, reason: 'You do not have access to Auto Apply', errorCode: 'ACCESS_DENIED' };
    }

    return { allowed: true };
}

module.exports = { resolveAutoApplyAccess };
