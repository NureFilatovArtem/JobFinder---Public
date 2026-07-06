const express = require('express');
const router = express.Router();
const autoApplyExecutor = require('../services/autoApplyExecutor');
const authenticateToken = require('../middleware/auth');
const autoApplyGate = require('../middleware/autoApplyGate');
const { getFeatureFlag } = require('../services/featureFlags');
const { isAdminOrOwner, hasAutoApplyAccess } = require('../services/accessControl');

/**
 * POST /api/auto-apply/queue
 * Add vacancy to auto-apply queue
 */
router.post('/queue', authenticateToken, autoApplyGate, async (req, res) => {
    try {
        const { vacancy_id } = req.body;
        const userId = req.user.id;

        console.log(`📋 [QUEUE] Single add request: user=${userId}, vacancy=${vacancy_id}`);

        if (!vacancy_id) {
            console.warn(`⚠️ [QUEUE] Missing vacancy_id in request body`);
            return res.status(400).json({
                error: 'Missing required field: vacancy_id'
            });
        }

        const queueItem = await autoApplyExecutor.addToQueue(userId, vacancy_id);
        console.log(`✅ [QUEUE] Added successfully: queue_id=${queueItem.id}, status=${queueItem.status}`);

        res.json({
            success: true,
            queue_id: queueItem.id,
            status: queueItem.status
        });
    } catch (error) {
        console.error('❌ [QUEUE] Add to queue error:', error.message);

        // Handle specific errors
        if (error.message.includes('Daily apply limit')) {
            return res.status(429).json({
                error: error.message,
                errorCode: 'DAILY_LIMIT_REACHED'
            });
        }

        if (error.message.includes('Already applied')) {
            return res.status(409).json({
                error: error.message,
                errorCode: 'ALREADY_APPLIED'
            });
        }

        if (error.message.includes('Subscription')) {
            return res.status(403).json({
                error: error.message,
                errorCode: 'SUBSCRIPTION_LIMIT'
            });
        }

        res.status(500).json({
            error: error.message || 'Failed to add to queue'
        });
    }
});

/**
 * POST /api/auto-apply/queue/bulk
 * Add multiple vacancies to queue
 */
router.post('/queue/bulk', authenticateToken, autoApplyGate, async (req, res) => {
    try {
        const { vacancy_ids } = req.body;
        const userId = req.user.id;

        console.log(`📋 [QUEUE] Bulk add request: user=${userId}, count=${vacancy_ids?.length || 0}`);

        if (!vacancy_ids || !Array.isArray(vacancy_ids) || vacancy_ids.length === 0) {
            console.warn(`⚠️ [QUEUE] Invalid vacancy_ids array`);
            return res.status(400).json({
                error: 'vacancy_ids array is required'
            });
        }

        const results = {
            success: [],
            failed: []
        };

        for (const vacancyId of vacancy_ids) {
            try {
                const queueItem = await autoApplyExecutor.addToQueue(userId, vacancyId);
                results.success.push({
                    vacancy_id: vacancyId,
                    queue_id: queueItem.id
                });
                console.log(`  ✅ Added vacancy ${vacancyId} → queue_id=${queueItem.id}`);
            } catch (error) {
                results.failed.push({
                    vacancy_id: vacancyId,
                    error: error.message
                });
                console.warn(`  ❌ Failed vacancy ${vacancyId}: ${error.message}`);
            }
        }

        console.log(`📊 [QUEUE] Bulk result: ${results.success.length} success, ${results.failed.length} failed`);

        res.json({
            success: true,
            enqueued: results.success.length,
            failed: results.failed.length,
            results
        });
    } catch (error) {
        console.error('❌ [QUEUE] Bulk queue error:', error.message);
        res.status(500).json({
            error: error.message || 'Failed to process bulk queue'
        });
    }
});

/**
 * GET /api/auto-apply/queue
 * Get user's queue
 */
router.get('/queue', authenticateToken, autoApplyGate, async (req, res) => {
    try {
        const userId = req.user.id;
        const queue = await autoApplyExecutor.getUserQueue(userId);

        res.json({
            success: true,
            queue
        });
    } catch (error) {
        console.error('Get queue error:', error);
        res.status(500).json({
            error: error.message || 'Failed to retrieve queue'
        });
    }
});

/**
 * GET /api/auto-apply/next
 * Get next pending queue item for extension
 */
router.get('/next', authenticateToken, autoApplyGate, async (req, res) => {
    try {
        const userId = req.user.id;
        const queueItem = await autoApplyExecutor.getNextQueueItem(userId);

        if (!queueItem) {
            return res.json({
                success: true,
                queue_item: null,
                message: 'No pending items'
            });
        }

        res.json({
            success: true,
            queue_item: queueItem
        });
    } catch (error) {
        console.error('Get next queue item error:', error);
        res.status(500).json({
            error: error.message || 'Failed to get next queue item'
        });
    }
});

/**
 * POST /api/auto-apply/complete
 * Mark queue item as completed — ownership enforced at SQL level
 */
router.post('/complete', authenticateToken, autoApplyGate, async (req, res) => {
    try {
        const { queue_id } = req.body;
        const userId = req.user.id;

        if (!queue_id) {
            return res.status(400).json({
                error: 'Missing required field: queue_id'
            });
        }

        await autoApplyExecutor.markCompleted(queue_id, userId);

        res.json({
            success: true,
            message: 'Queue item marked as completed'
        });
    } catch (error) {
        if (error.message.includes('FORBIDDEN')) {
            return res.status(403).json({ error: 'Access denied: queue item does not belong to you' });
        }
        console.error('Mark completed error:', error);
        res.status(500).json({
            error: error.message || 'Failed to mark as completed'
        });
    }
});

/**
 * POST /api/auto-apply/fail
 * Mark queue item as failed — ownership enforced at SQL level
 */
router.post('/fail', authenticateToken, autoApplyGate, async (req, res) => {
    try {
        const { queue_id, error_message, should_retry } = req.body;
        const userId = req.user.id;

        if (!queue_id || !error_message) {
            return res.status(400).json({
                error: 'Missing required fields: queue_id, error_message'
            });
        }

        const item = await autoApplyExecutor.markFailed(
            queue_id,
            userId,
            error_message,
            should_retry !== false
        );

        res.json({
            success: true,
            status: item.status,
            attempts: item.attempts,
            max_attempts: item.max_attempts
        });
    } catch (error) {
        if (error.message.includes('FORBIDDEN')) {
            return res.status(403).json({ error: 'Access denied: queue item does not belong to you' });
        }
        console.error('Mark failed error:', error);
        res.status(500).json({
            error: error.message || 'Failed to mark as failed'
        });
    }
});

/**
 * POST /api/auto-apply/skip
 * Mark queue item as skipped (e.g., CAPTCHA detected) — ownership enforced at SQL level
 */
router.post('/skip', authenticateToken, autoApplyGate, async (req, res) => {
    try {
        const { queue_id, reason } = req.body;
        const userId = req.user.id;

        if (!queue_id || !reason) {
            return res.status(400).json({
                error: 'Missing required fields: queue_id, reason'
            });
        }

        await autoApplyExecutor.markSkipped(queue_id, userId, reason);

        res.json({
            success: true,
            message: 'Queue item marked as skipped'
        });
    } catch (error) {
        if (error.message.includes('FORBIDDEN')) {
            return res.status(403).json({ error: 'Access denied: queue item does not belong to you' });
        }
        console.error('Mark skipped error:', error);
        res.status(500).json({
            error: error.message || 'Failed to mark as skipped'
        });
    }
});

/**
 * POST /api/auto-apply/log
 * Log auto-apply action
 */
router.post('/log', authenticateToken, autoApplyGate, async (req, res) => {
    try {
        const {
            queue_id,
            vacancy_id,
            action_type,
            selector,
            value_key,
            success,
            error_message,
            duration_ms
        } = req.body;

        const userId = req.user.id;

        await autoApplyExecutor.logAction({
            queueId: queue_id,
            userId,
            vacancyId: vacancy_id,
            actionType: action_type,
            selector,
            valueKey: value_key,
            success,
            errorMessage: error_message,
            durationMs: duration_ms
        });

        res.json({
            success: true,
            message: 'Action logged'
        });
    } catch (error) {
        console.error('Log action error:', error);
        res.status(500).json({
            error: error.message || 'Failed to log action'
        });
    }
});

/**
 * GET /api/auto-apply/status
 * Get auto-apply statuses for vacancies (for UI)
 */
router.get('/status', authenticateToken, autoApplyGate, async (req, res) => {
    try {
        const userId = req.user.id;
        const queue = await autoApplyExecutor.getUserQueue(userId);

        const statusMap = {};
        queue.forEach(item => {
            statusMap[item.vacancy_id] = item.status;
        });

        res.json(statusMap);
    } catch (error) {
        console.error('Get status error:', error);
        res.status(500).json({
            error: error.message || 'Failed to get statuses'
        });
    }
});

/**
 * GET /api/auto-apply/access
 * Returns whether the current user has Auto Apply access.
 * Used by frontend to determine UI visibility.
 * Does NOT go through autoApplyGate (it IS the access check).
 */
router.get('/access', authenticateToken, async (req, res) => {
    try {
        const featureEnabled = await getFeatureFlag('auto_apply_enabled');
        const accessGranted = await hasAutoApplyAccess(req.user);
        const privileged = isAdminOrOwner(req.user);

        res.json({
            hasAccess: accessGranted,
            featureEnabled,
            isPrivileged: privileged
        });
    } catch (error) {
        console.error('Access check error:', error);
        res.status(500).json({ error: 'Access check failed' });
    }
});

module.exports = router;
