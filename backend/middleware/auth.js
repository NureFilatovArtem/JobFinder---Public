/**
 * Authentication Middleware - Enterprise Grade
 * 
 * Features:
 * - Strict JWT_SECRET validation (no fallback)
 * - Self-cleaning throttle cache (no memory leaks)
 * - Clean async/await syntax
 */

const jwt = require('jsonwebtoken');
const { db } = require('../database');

// ===== STRICT SECRET VALIDATION =====
// No fallback - if JWT_SECRET is undefined, the app MUST NOT start
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('❌ FATAL: JWT_SECRET environment variable is not set!');
    console.error('   Please set JWT_SECRET in your .env file or environment.');
    console.error('   The application cannot start without a valid JWT secret.');
    process.exit(1);
}
console.log(`🔒 Auth Middleware: JWT_SECRET loaded. Length: ${JWT_SECRET.length}`);

// ===== SELF-CLEANING THROTTLE CACHE =====
// Prevents memory leaks by auto-deleting entries after 5 minutes
const AUTH_LOG_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes
const throttleCache = new Map();

/**
 * Check if we should log auth success for this user
 * Uses self-cleaning map to prevent memory leaks
 */
function shouldLogAuthSuccess(userId) {
    if (throttleCache.has(userId)) {
        return false;
    }

    // Mark user as recently logged
    throttleCache.set(userId, true);

    // Auto-clean after throttle period (prevents memory leak)
    setTimeout(() => {
        throttleCache.delete(userId);
    }, AUTH_LOG_THROTTLE_MS);

    return true;
}

/**
 * Main authentication middleware
 * Verifies JWT token and attaches user to request
 */
const authMiddleware = async (req, res, next) => {
    try {
        // 1. Try httpOnly cookie first (web application)
        // 2. Fall back to Authorization header (browser extension, API clients)
        let token = req.cookies?.access_token;

        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.split(' ')[1];
            }
        }

        if (!token) {
            console.warn('⚠️ Auth: No token found in cookie or authorization header');
            return res.status(401).json({
                error: 'Authentication required',
                errorCode: 'NOT_AUTHENTICATED'
            });
        }

        // Verify JWT
        const decoded = jwt.verify(token, JWT_SECRET);

        // Get fresh user data from DB using clean async/await
        const result = await db.query(
            'SELECT id, email, name, phone, role, subscription_plan_id, auto_applies_used, resume_url, cv_generations_today, last_cv_generation_date FROM users WHERE id = $1',
            [decoded.userId]
        );

        const user = result.rows[0];

        if (!user) {
            console.warn(`⚠️ Auth: User not found for ID ${decoded.userId}`);
            return res.status(401).json({
                error: 'User not found',
                errorCode: 'USER_NOT_FOUND'
            });
        }

        // Set user on request
        req.user = user;

        // Throttled success logging (only once per 5 min per user)
        if (shouldLogAuthSuccess(user.id)) {
            console.log(`✅ Auth: User ${user.id} (${user.email}) authenticated`);
        }

        next();
    } catch (error) {
        // Always log errors immediately
        console.error('❌ Auth Error:', error.message);
        return res.status(401).json({
            error: 'Invalid token',
            errorCode: 'INVALID_TOKEN'
        });
    }
};

/**
 * Admin check middleware
 * Must be used AFTER authMiddleware (requires req.user to be set)
 * Allows 'admin' and 'owner' roles
 */
const checkIsAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Authentication required',
            errorCode: 'NOT_AUTHENTICATED'
        });
    }

    const allowedRoles = ['admin', 'owner'];
    if (!allowedRoles.includes(req.user.role)) {
        console.warn(`⚠️ Admin check failed: User ${req.user.id} (${req.user.email}) has role '${req.user.role}'`);
        return res.status(403).json({
            error: 'Admin access required',
            errorCode: 'FORBIDDEN',
            message: 'You do not have permission to access this resource'
        });
    }

    next();
};

module.exports = authMiddleware;
module.exports.checkIsAdmin = checkIsAdmin;
