/**
 * Auto Apply Gate Middleware
 *
 * Thin middleware that delegates ALL access decisions to resolveAutoApplyAccess.
 * Applied to both JWT-authenticated and session-authenticated routes.
 * Must be placed AFTER authenticateToken or sessionAuth middleware.
 */

const { resolveAutoApplyAccess } = require('../services/resolveAccess');

const autoApplyGate = async (req, res, next) => {
    try {
        const result = await resolveAutoApplyAccess(req.user);

        if (!result.allowed) {
            const status = result.errorCode === 'NOT_AUTHENTICATED' ? 401 : 403;
            return res.status(status).json({
                error: result.reason,
                errorCode: result.errorCode
            });
        }

        next();
    } catch (error) {
        console.error('❌ Auto Apply gate error:', error.message);
        return res.status(500).json({ error: 'Access check failed' });
    }
};

module.exports = autoApplyGate;
