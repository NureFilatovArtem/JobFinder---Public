/**
 * Session Authentication Middleware
 *
 * Converts a session token into req.user so that autoApplyGate
 * can be applied identically to session-based and JWT-based routes.
 *
 * Session token is accepted ONLY from headers:
 *   - "Authorization: Bearer <token>"
 *   - "X-Session-Token: <token>"
 *
 * Tokens from query/body are REJECTED.
 *
 * After this middleware, req.user is guaranteed to have { id, role }.
 */

const { db } = require('../database');

const MIN_TOKEN_LENGTH = 20;

const sessionAuth = async (req, res, next) => {
    try {
        // --- Extract token from headers ONLY ---
        let sessionToken = null;

        // Option 1: Authorization: Bearer <token>
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            sessionToken = authHeader.split(' ')[1];
        }

        // Option 2: X-Session-Token header
        if (!sessionToken && req.headers['x-session-token']) {
            sessionToken = req.headers['x-session-token'];
        }

        // --- Validate token format ---
        if (!sessionToken) {
            return res.status(400).json({
                error: 'Missing session token. Provide via Authorization header or X-Session-Token header.',
                errorCode: 'MISSING_TOKEN'
            });
        }

        if (typeof sessionToken !== 'string' || sessionToken.length < MIN_TOKEN_LENGTH) {
            return res.status(400).json({
                error: 'Invalid session token format',
                errorCode: 'INVALID_TOKEN_FORMAT'
            });
        }

        // --- Verify session existence ---
        const sessionResult = await db.query(
            `SELECT user_id FROM automation_sessions
             WHERE session_token = $1 AND is_active = true`,
            [sessionToken]
        );

        if (sessionResult.rows.length === 0) {
            return res.status(401).json({
                error: 'Invalid or expired session',
                errorCode: 'INVALID_SESSION'
            });
        }

        const userId = sessionResult.rows[0].user_id;

        // --- Verify user existence ---
        const userResult = await db.query(
            'SELECT id, email, name, role FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                error: 'User not found',
                errorCode: 'USER_NOT_FOUND'
            });
        }

        // --- Set req.user with guaranteed { id, role } ---
        const user = userResult.rows[0];
        req.user = {
            ...user,
            role: user.role || 'user'  // defensive fallback
        };
        req.sessionToken = sessionToken;

        next();
    } catch (error) {
        console.error('❌ Session auth error:', error.message);
        return res.status(500).json({ error: 'Session validation failed' });
    }
};

module.exports = sessionAuth;
