/**
 * Admin Cleanup Routes
 * 
 * Routes for managing and monitoring vacancy cleanup
 * All routes require admin/owner role
 */

const express = require('express');
const router = express.Router();
const vacancyCleanupService = require('../services/vacancyCleanupService');
const authMiddleware = require('../middleware/auth');
const { checkIsAdmin } = require('../middleware/auth');

// Apply auth + admin check to ALL routes in this router
router.use(authMiddleware);
router.use(checkIsAdmin);

/**
 * GET /api/admin/cleanup/status
 * Get cleanup statistics and status
 */
router.get('/status', async (req, res) => {
    try {
        const stats = await vacancyCleanupService.getCleanupStats();
        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('[Cleanup] Error getting stats:', error);
        res.status(500).json({
            error: 'Failed to get cleanup stats',
            message: error.message
        });
    }
});

/**
 * GET /api/admin/cleanup/logs
 * Get recent cleanup log entries
 */
router.get('/logs', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const logs = await vacancyCleanupService.getRecentLogs(limit);
        res.json({
            success: true,
            count: logs.length,
            logs
        });
    } catch (error) {
        console.error('[Cleanup] Error getting logs:', error);
        res.status(500).json({
            error: 'Failed to get cleanup logs',
            message: error.message
        });
    }
});

/**
 * POST /api/admin/cleanup/run
 * Manually trigger cleanup process
 * Body: { maxDeletions?: number } (optional, defaults to 15)
 */
router.post('/run', async (req, res) => {
    try {
        const { maxDeletions } = req.body;
        const limit = maxDeletions ? Math.min(parseInt(maxDeletions), 15) : 15;

        console.log(`[Cleanup] Manual cleanup triggered with limit: ${limit}`);

        const result = await vacancyCleanupService.runDailyCleanup(limit);

        res.json({
            success: true,
            message: result.limitReached
                ? 'Cleanup completed (daily limit reached)'
                : 'Cleanup completed',
            result
        });
    } catch (error) {
        console.error('[Cleanup] Error running cleanup:', error);
        res.status(500).json({
            error: 'Failed to run cleanup',
            message: error.message
        });
    }
});

/**
 * GET /api/admin/cleanup/stale
 * Preview stale vacancies that would be checked
 */
router.get('/stale', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const staleVacancies = await vacancyCleanupService.getStaleVacancies(limit);
        res.json({
            success: true,
            count: staleVacancies.length,
            vacancies: staleVacancies
        });
    } catch (error) {
        console.error('[Cleanup] Error getting stale vacancies:', error);
        res.status(500).json({
            error: 'Failed to get stale vacancies',
            message: error.message
        });
    }
});

module.exports = router;
