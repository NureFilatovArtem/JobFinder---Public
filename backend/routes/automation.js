const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const formAnalyzerService = require('../services/formAnalyzerService');
const authenticateToken = require('../middleware/auth');
const sessionAuth = require('../middleware/sessionAuth');
const autoApplyGate = require('../middleware/autoApplyGate');

// Subscription plan constants
const SUBSCRIPTION_PLANS = {
    FREE: { id: 1, name: 'free', price: 0, autoApplyLimit: 0 },
    STARTER: { id: 2, name: 'starter', price: 1500, autoApplyLimit: 0 },
    PRO: { id: 3, name: 'pro', price: 2000, autoApplyLimit: -1 }, // -1 = unlimited
    FAST: { id: 4, name: 'fast', price: 10000, autoApplyLimit: 500 }
};

// In-memory session store (for scaling, use Redis)
const activeSessions = new Map();

// Helper to get database instance
const getDb = () => {
    const { db, DATABASE_TYPE } = require('../database');
    return { db, DATABASE_TYPE };
};

// ===========================================
// GET /api/automation/status
// Get user's automation status, extension connection, and balance
// Uses JWT authentication - userId from token
// ===========================================
router.get('/status', authenticateToken, autoApplyGate, async (req, res) => {
    try {
        const userId = req.user.id;  // From JWT token
        const { db } = getDb();

        // Get user's subscription and automation status
        const userQuery = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.auto_applies_used,
        u.auto_applies_reset_at,
        u.resume_url,
        sp.name as plan_name,
        sp.display_name as plan_display_name,
        sp.auto_apply_limit,
        sp.features
      FROM users u
      LEFT JOIN subscription_plans sp ON u.subscription_plan_id = sp.id
      WHERE u.id = $1
    `;

        const userResult = await db.query(userQuery, [userId]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];

        // Get active session if any
        const sessionQuery = `
      SELECT session_token, ip_address, last_ping_at, created_at
      FROM automation_sessions
      WHERE user_id = $1 AND is_active = true
      ORDER BY last_ping_at DESC
      LIMIT 1
    `;
        const sessionResult = await db.query(sessionQuery, [userId]);
        const activeSession = sessionResult.rows[0] || null;

        // Get queue stats
        const queueQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'processing') as processing,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
      FROM auto_apply_queue
      WHERE user_id = $1
    `;
        const queueResult = await db.query(queueQuery, [userId]);
        const queueStats = queueResult.rows[0];

        // Calculate remaining applies
        const limit = user.auto_apply_limit;
        const used = user.auto_applies_used || 0;
        const remaining = limit === -1 ? 'unlimited' : Math.max(0, limit - used);

        res.json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                resumeUrl: user.resume_url
            },
            subscription: {
                plan: user.plan_name || 'free',
                displayName: user.plan_display_name || 'Free',
                autoApplyLimit: limit,
                autoAppliesUsed: used,
                autoAppliesRemaining: remaining,
                features: user.features || []
            },
            extension: {
                connected: !!activeSession,
                ipAddress: activeSession?.ip_address || null,
                lastPing: activeSession?.last_ping_at || null,
                sessionToken: activeSession?.session_token || null
            },
            queue: {
                pending: parseInt(queueStats.pending) || 0,
                processing: parseInt(queueStats.processing) || 0,
                completed: parseInt(queueStats.completed) || 0,
                failed: parseInt(queueStats.failed) || 0
            }
        });

    } catch (error) {
        console.error('Error fetching automation status:', error);
        res.status(500).json({ error: 'Failed to fetch automation status', message: error.message });
    }
});

// ===========================================
// POST /api/automation/connect
// Register extension session
// ===========================================
router.post('/connect', sessionAuth, autoApplyGate, async (req, res) => {
    try {
        const { userAgent } = req.body;
        const userId = req.user.id;
        const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

        const { db } = getDb();

        // Generate session token
        const sessionToken = crypto.randomBytes(32).toString('hex');

        // Deactivate any existing sessions for this user
        await db.query(
            'UPDATE automation_sessions SET is_active = false WHERE user_id = $1',
            [userId]
        );

        // Create new session
        const insertQuery = `
      INSERT INTO automation_sessions (user_id, session_token, ip_address, user_agent, is_active, last_ping_at)
      VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP)
      RETURNING id, session_token, ip_address, created_at
    `;

        const result = await db.query(insertQuery, [userId, sessionToken, ipAddress, userAgent || '']);
        const session = result.rows[0];

        // Store in memory for quick access
        activeSessions.set(sessionToken, {
            userId,
            ipAddress,
            lastPing: Date.now()
        });

        console.log(`Extension connected: User ${userId} from ${ipAddress}`);

        res.json({
            success: true,
            session: {
                token: session.session_token,
                ipAddress: session.ip_address,
                createdAt: session.created_at
            }
        });

    } catch (error) {
        console.error('Error connecting extension:', error);
        res.status(500).json({ error: 'Failed to connect extension', message: error.message });
    }
});

// ===========================================
// POST /api/automation/ping
// Keep session alive
// ===========================================
router.post('/ping', sessionAuth, async (req, res) => {
    try {
        const { db } = getDb();
        const sessionToken = req.sessionToken;
        const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        // Update last ping time
        const result = await db.query(
            `UPDATE automation_sessions 
       SET last_ping_at = CURRENT_TIMESTAMP, ip_address = $2
       WHERE session_token = $1 AND is_active = true
       RETURNING user_id`,
            [sessionToken, ipAddress]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid or expired session' });
        }

        // Update in-memory cache
        if (activeSessions.has(sessionToken)) {
            activeSessions.get(sessionToken).lastPing = Date.now();
            activeSessions.get(sessionToken).ipAddress = ipAddress;
        }

        res.json({ success: true, timestamp: new Date().toISOString() });

    } catch (error) {
        console.error('Error processing ping:', error);
        res.status(500).json({ error: 'Ping failed' });
    }
});

// ===========================================
// POST /api/automation/disconnect
// Disconnect extension session
// ===========================================
router.post('/disconnect', sessionAuth, async (req, res) => {
    try {
        const sessionToken = req.sessionToken;
        const { db } = getDb();

        await db.query(
            'UPDATE automation_sessions SET is_active = false WHERE session_token = $1',
            [sessionToken]
        );

        activeSessions.delete(sessionToken);

        console.log(`Extension disconnected: ${sessionToken.substring(0, 8)}...`);

        res.json({ success: true });

    } catch (error) {
        console.error('Error disconnecting:', error);
        res.status(500).json({ error: 'Disconnect failed' });
    }
});

// ===========================================
// GET /api/automation/queue
// Get next pending job for extension to process
// ===========================================
router.get('/queue', sessionAuth, autoApplyGate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { db } = getDb();

        // Check user's plan allows auto-apply
        const userResult = await db.query(
            `SELECT u.auto_applies_used, sp.auto_apply_limit
       FROM users u
       LEFT JOIN subscription_plans sp ON u.subscription_plan_id = sp.id
       WHERE u.id = $1`,
            [userId]
        );

        const user = userResult.rows[0];
        const limit = user?.auto_apply_limit || 0;
        const used = user?.auto_applies_used || 0;

        // Check if user has remaining applies
        if (limit !== -1 && used >= limit) {
            return res.json({
                job: null,
                reason: 'limit_reached',
                message: 'Auto-apply limit reached for your plan'
            });
        }

        // Get next pending job (prioritize higher priority, oldest first)
        const jobResult = await db.query(
            `UPDATE auto_apply_queue
       SET status = 'processing', started_at = CURRENT_TIMESTAMP
       WHERE id = (
         SELECT id FROM auto_apply_queue
         WHERE user_id = $1 AND status = 'pending' AND attempts < max_attempts
         ORDER BY priority DESC, created_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, vacancy_id, job_url, action_plan, attempts`,
            [userId]
        );

        if (jobResult.rows.length === 0) {
            return res.json({ job: null, reason: 'queue_empty' });
        }

        const job = jobResult.rows[0];

        // Get user profile for form filling
        const profileResult = await db.query(
            `SELECT name, email, phone, resume_url FROM users WHERE id = $1`,
            [userId]
        );
        const profile = profileResult.rows[0] || {};

        res.json({
            job: {
                id: job.id,
                vacancyId: job.vacancy_id,
                url: job.job_url,
                actionPlan: job.action_plan,
                attempts: job.attempts
            },
            userProfile: {
                name: profile.name,
                email: profile.email,
                phone: profile.phone,
                resumeUrl: profile.resume_url
            }
        });

    } catch (error) {
        console.error('Error fetching queue:', error);
        res.status(500).json({ error: 'Failed to fetch queue' });
    }
});

// ===========================================
// POST /api/automation/analyze
// Receive HTML and analyze with Gemini
// ===========================================
router.post('/analyze', sessionAuth, autoApplyGate, async (req, res) => {
    try {
        const { html, url, queueId } = req.body;

        if (!html || !url) {
            return res.status(400).json({ error: 'html and url are required' });
        }

        const { db } = getDb();
        const userId = req.user.id;

        // Get user profile for context
        const profileResult = await db.query(
            `SELECT name, email, phone FROM users WHERE id = $1`,
            [userId]
        );
        const userProfile = profileResult.rows[0] || {};

        // Analyze with Gemini
        const startTime = Date.now();
        const actionPlan = await formAnalyzerService.analyzeForm(html, url, userProfile);
        const duration = Date.now() - startTime;

        // Log the analysis
        await db.query(
            `INSERT INTO auto_apply_logs (queue_id, user_id, action_type, success, duration_ms)
       VALUES ($1, $2, 'analyze', $3, $4)`,
            [queueId || null, userId, actionPlan.form_type !== 'parse_error', duration]
        );

        // Cache the action plan if queueId provided — ownership enforced at SQL level
        if (queueId) {
            const updateResult = await db.query(
                `UPDATE auto_apply_queue SET action_plan = $1 WHERE id = $2 AND user_id = $3`,
                [JSON.stringify(actionPlan), queueId, userId]
            );
            if (updateResult.rowCount === 0) {
                return res.status(403).json({ error: 'Access denied: queue item does not belong to you' });
            }
        }

        res.json({
            success: true,
            actionPlan,
            duration
        });

    } catch (error) {
        console.error('Error analyzing form:', error);
        res.status(500).json({ error: 'Form analysis failed', message: error.message });
    }
});

// ===========================================
// POST /api/automation/complete
// Report job completion and update balance
// ===========================================
router.post('/complete', sessionAuth, autoApplyGate, async (req, res) => {
    try {
        const { queueId, success, errorMessage, logs } = req.body;

        if (!queueId) {
            return res.status(400).json({ error: 'queueId is required' });
        }

        const { db } = getDb();
        const userId = req.user.id;

        // Update queue item
        const status = success ? 'completed' : 'failed';
        await db.query(
            `UPDATE auto_apply_queue 
       SET status = $1, completed_at = CURRENT_TIMESTAMP, 
           error_message = $2, attempts = attempts + 1
       WHERE id = $3 AND user_id = $4`,
            [status, errorMessage || null, queueId, userId]
        );

        // If successful, decrement user's balance
        if (success) {
            await db.query(
                `UPDATE users SET auto_applies_used = auto_applies_used + 1 WHERE id = $1`,
                [userId]
            );
        }

        // Insert detailed logs
        if (logs && Array.isArray(logs)) {
            const logQuery = `
        INSERT INTO auto_apply_logs (queue_id, user_id, action_type, selector, value_key, success, error_message, duration_ms)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;

            for (const log of logs) {
                await db.query(logQuery, [
                    queueId,
                    userId,
                    log.actionType || 'unknown',
                    log.selector || null,
                    log.valueKey || null,
                    log.success || false,
                    log.errorMessage || null,
                    log.duration || null
                ]);
            }
        }

        console.log(`Job ${queueId} ${status} for user ${userId}`);

        res.json({ success: true, status });

    } catch (error) {
        console.error('Error completing job:', error);
        res.status(500).json({ error: 'Failed to complete job' });
    }
});

// ===========================================
// POST /api/automation/queue/add
// Add jobs from Geselecteerd to queue
// Uses JWT authentication - userId from token
// ===========================================
router.post('/queue/add', authenticateToken, autoApplyGate, async (req, res) => {
    try {
        const userId = req.user.id;  // From JWT token
        const { vacancyIds } = req.body;

        if (!Array.isArray(vacancyIds) || vacancyIds.length === 0) {
            return res.status(400).json({ error: 'vacancyIds array is required' });
        }

        const { db } = getDb();

        // Check user has auto-apply enabled (owners bypass this)
        const userResult = await db.query(
            `SELECT u.role, sp.auto_apply_limit, u.auto_applies_used
       FROM users u
       LEFT JOIN subscription_plans sp ON u.subscription_plan_id = sp.id
       WHERE u.id = $1`,
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isOwner = userResult.rows[0].role === 'owner';
        const limit = userResult.rows[0].auto_apply_limit;

        // Only check limit for non-owners
        if (!isOwner && limit === 0) {
            return res.status(403).json({
                error: 'Auto-apply not available on your plan',
                upgrade: 'Upgrade to Pro or Fast plan to use auto-apply'
            });
        }

        if (isOwner) {
            console.log(`👑 Owner bypass: User ${userId} has unlimited auto-apply access`);
        }

        // Get vacancy URLs
        const vacanciesResult = await db.query(
            `SELECT id, source_url FROM vacancies WHERE id = ANY($1)`,
            [vacancyIds]
        );

        // Insert into queue (ignore duplicates)
        let added = 0;
        for (const vacancy of vacanciesResult.rows) {
            try {
                await db.query(
                    `INSERT INTO auto_apply_queue (user_id, vacancy_id, job_url, status, priority)
           VALUES ($1, $2, $3, 'pending', 0)
           ON CONFLICT (user_id, vacancy_id) DO NOTHING`,
                    [userId, vacancy.id, vacancy.source_url]
                );
                added++;
            } catch (e) {
                // Skip duplicates
            }
        }

        res.json({
            success: true,
            added,
            total: vacancyIds.length,
            message: `Added ${added} jobs to auto-apply queue`
        });

    } catch (error) {
        console.error('Error adding to queue:', error);
        res.status(500).json({ error: 'Failed to add to queue' });
    }
});

// ===========================================
// GET /api/automation/plans
// Get available subscription plans
// ===========================================
router.get('/plans', async (req, res) => {
    try {
        const { db } = getDb();

        const result = await db.query(
            `SELECT id, name, display_name, price_cents, currency, auto_apply_limit, features
       FROM subscription_plans
       WHERE is_active = true
       ORDER BY price_cents ASC`
        );

        res.json({
            plans: result.rows.map(plan => ({
                id: plan.id,
                name: plan.name,
                displayName: plan.display_name,
                price: plan.price_cents / 100,
                currency: plan.currency,
                autoApplyLimit: plan.auto_apply_limit,
                features: plan.features
            }))
        });

    } catch (error) {
        console.error('Error fetching plans:', error);
        res.status(500).json({ error: 'Failed to fetch plans' });
    }
});

module.exports = router;
