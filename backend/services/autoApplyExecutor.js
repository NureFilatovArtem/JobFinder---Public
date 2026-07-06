/**
 * Auto-Apply Executor Service
 * Handles queue execution, eligibility checks, asset resolution, and daily limits
 */

const db = require('../database/postgres');
const assetActivation = require('./assetActivation');

class AutoApplyExecutor {
    /**
     * Add job to auto-apply queue
     * @param {number} userId - User ID
     * @param {number} vacancyId - Vacancy ID
     * @returns {Promise<Object>} Queue item
     */
    async addToQueue(userId, vacancyId) {
        console.log(`📋 Adding vacancy ${vacancyId} to queue for user ${userId}`);

        // Pre-execution eligibility checks
        await this.validateEligibility(userId, vacancyId);

        // Get vacancy URL
        const vacancyResult = await db.query(
            'SELECT source_url FROM vacancies WHERE id = $1',
            [vacancyId]
        );
        const jobUrl = vacancyResult.rows[0].source_url;

        // Get active assets (optional at queue time, resolved at execution)
        const resumeAsset = await assetActivation.getActiveAsset(userId, vacancyId, 'resume');
        const coverLetterAsset = await assetActivation.getActiveAsset(userId, vacancyId, 'cover_letter');
        const followUpAsset = await assetActivation.getActiveAsset(userId, vacancyId, 'follow_up');

        // Insert into queue
        const result = await db.query(
            `INSERT INTO auto_apply_queue 
       (user_id, vacancy_id, job_url, status, priority, resume_asset_id, cover_letter_asset_id, follow_up_asset_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id, vacancy_id) DO UPDATE
       SET status = EXCLUDED.status, priority = EXCLUDED.priority
       RETURNING *`,
            [
                userId,
                vacancyId,
                jobUrl,
                'pending',
                0,
                resumeAsset?.id || null,
                coverLetterAsset?.id || null,
                followUpAsset?.id || null
            ]
        );

        console.log(`✅ Added to queue: ${result.rows[0].id}`);
        return result.rows[0];
    }

    /**
     * Validate eligibility before adding to queue
     */
    async validateEligibility(userId, vacancyId) {
        // 1. Check user exists and is authenticated
        const userResult = await db.query(
            'SELECT id, role, auto_applies_used, daily_apply_limit, subscription_plan_id FROM users WHERE id = $1',
            [userId]
        );
        if (userResult.rows.length === 0) {
            throw new Error('User not found');
        }

        const user = userResult.rows[0];

        // Owner bypass: Owners can always use auto-apply regardless of plan
        const isOwner = user.role === 'owner';
        if (isOwner) {
            console.log(`👑 Owner bypass: User ${userId} has unlimited auto-apply access`);
        }

        // 2. Check vacancy exists and is active
        const vacancyResult = await db.query(
            'SELECT id, is_active FROM vacancies WHERE id = $1',
            [vacancyId]
        );
        if (vacancyResult.rows.length === 0) {
            throw new Error('Vacancy not found');
        }
        if (!vacancyResult.rows[0].is_active) {
            throw new Error('Vacancy is not active');
        }

        // 3. Check if already applied
        const appliedResult = await db.query(
            'SELECT is_applied FROM user_vacancy_scores WHERE user_id = $1 AND vacancy_id = $2',
            [userId, vacancyId]
        );
        if (appliedResult.rows.length > 0 && appliedResult.rows[0].is_applied) {
            throw new Error('Already applied to this vacancy');
        }

        // 4. Check daily limit (skip for owner)
        if (!isOwner && user.auto_applies_used >= user.daily_apply_limit) {
            throw new Error('Daily apply limit reached');
        }

        // 5. Check subscription allows auto-apply (skip for owner)
        if (!isOwner) {
            const planResult = await db.query(
                'SELECT auto_apply_limit FROM subscription_plans WHERE id = $1',
                [user.subscription_plan_id]
            );
            if (planResult.rows.length > 0) {
                const autoApplyLimit = planResult.rows[0].auto_apply_limit;
                if (autoApplyLimit === 0) {
                    throw new Error('Subscription plan does not allow auto-apply');
                }
            }
        }
    }

    /**
     * Get next pending queue item for user (for extension polling)
     * @param {number} userId - User ID
     * @returns {Promise<Object|null>}
     */
    async getNextQueueItem(userId) {
        // Re-validate daily limit at execution time
        const userResult = await db.query(
            'SELECT auto_applies_used, daily_apply_limit FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return null;
        }

        const user = userResult.rows[0];
        if (user.auto_applies_used >= user.daily_apply_limit) {
            console.log(`⏸️ User ${userId} has reached daily limit`);
            return null;
        }

        // Atomic claim with row-level lock
        const client = await db.getClient();

        try {
            await client.query('BEGIN');

            const result = await client.query(
                `UPDATE auto_apply_queue
         SET status = 'processing', started_at = CURRENT_TIMESTAMP
         WHERE id = (
           SELECT id FROM auto_apply_queue
           WHERE user_id = $1 AND status = 'pending' AND attempts < max_attempts
           ORDER BY priority DESC, created_at ASC
           LIMIT 1
           FOR UPDATE SKIP LOCKED
         )
         RETURNING *`,
                [userId]
            );

            await client.query('COMMIT');

            if (result.rows.length === 0) {
                return null;
            }

            const queueItem = result.rows[0];

            // Resolve latest active assets
            const assets = await this.resolveAssets(userId, queueItem.vacancy_id);

            // Get vacancy details
            const vacancyResult = await client.query(
                'SELECT * FROM vacancies WHERE id = $1',
                [queueItem.vacancy_id]
            );

            return {
                ...queueItem,
                vacancy: vacancyResult.rows[0],
                assets
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Resolve latest active assets for execution
     * NOTE: Resume check is relaxed for Phase 2A testing.
     * TODO: Re-enable strict resume check for production.
     */
    async resolveAssets(userId, vacancyId) {
        const resume = await assetActivation.getActiveAsset(userId, vacancyId, 'resume');
        const coverLetter = await assetActivation.getActiveAsset(userId, vacancyId, 'cover_letter');
        const followUp = await assetActivation.getActiveAsset(userId, vacancyId, 'follow_up');

        // PHASE 2A: Resume is optional for testing
        // TODO: Uncomment for production
        // if (!resume) {
        //     throw new Error('Missing required asset: resume');
        // }

        if (!resume) {
            console.warn(`⚠️ [PHASE 2A] No resume for user ${userId}, vacancy ${vacancyId}. Proceeding without resume for testing.`);
        }

        return {
            resume_url: resume?.file_url || null,
            cover_letter_url: coverLetter?.file_url || null,
            follow_up_url: followUp?.file_url || null
        };
    }

    /**
     * Mark queue item as completed
     * @param {number} queueId - Queue item ID
     * @param {number} userId - Authenticated user ID (ownership enforcement)
     */
    async markCompleted(queueId, userId) {
        if (!userId) throw new Error('userId is required for markCompleted');
        const client = await db.getClient();

        try {
            await client.query('BEGIN');

            // Update queue status — ownership enforced at SQL level
            const queueResult = await client.query(
                `UPDATE auto_apply_queue 
         SET status = 'completed', completed_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND user_id = $2
         RETURNING user_id, vacancy_id`,
                [queueId, userId]
            );

            if (queueResult.rowCount === 0) {
                await client.query('ROLLBACK');
                throw new Error('FORBIDDEN: Queue item not found or does not belong to user');
            }

            const { vacancy_id } = queueResult.rows[0];

            // Increment daily counter with atomic check
            const userResult = await client.query(
                `UPDATE users 
         SET auto_applies_used = auto_applies_used + 1
         WHERE id = $1 AND auto_applies_used < daily_apply_limit
         RETURNING auto_applies_used`,
                [userId]
            );

            if (userResult.rows.length === 0) {
                throw new Error('Daily limit exceeded');
            }

            // Mark as applied in user_vacancy_scores
            await client.query(
                `INSERT INTO user_vacancy_scores (user_id, vacancy_id, is_applied, applied_at)
         VALUES ($1, $2, true, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id, vacancy_id) DO UPDATE
         SET is_applied = true, applied_at = CURRENT_TIMESTAMP`,
                [userId, vacancy_id]
            );

            await client.query('COMMIT');

            console.log(`✅ Completed queue item ${queueId}`);
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Mark queue item as failed
     * @param {number} queueId - Queue item ID
     * @param {number} userId - Authenticated user ID (ownership enforcement)
     * @param {string} errorMessage - Error description
     * @param {boolean} shouldRetry - Whether to retry
     */
    async markFailed(queueId, userId, errorMessage, shouldRetry = true) {
        if (!userId) throw new Error('userId is required for markFailed');
        const result = await db.query(
            `UPDATE auto_apply_queue 
       SET attempts = attempts + 1,
           error_message = $3,
           status = CASE 
             WHEN attempts + 1 >= max_attempts THEN 'failed'
             WHEN $4 = false THEN 'failed'
             ELSE 'pending'
           END
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
            [queueId, userId, errorMessage, shouldRetry]
        );

        if (result.rowCount === 0) {
            throw new Error('FORBIDDEN: Queue item not found or does not belong to user');
        }

        const item = result.rows[0];
        console.log(`⚠️ Failed queue item ${queueId}: ${errorMessage} (attempt ${item.attempts}/${item.max_attempts})`);

        return item;
    }

    /**
     * Mark queue item as skipped (e.g., CAPTCHA detected)
     * @param {number} queueId - Queue item ID
     * @param {number} userId - Authenticated user ID (ownership enforcement)
     * @param {string} reason - Skip reason
     */
    async markSkipped(queueId, userId, reason) {
        if (!userId) throw new Error('userId is required for markSkipped');
        const result = await db.query(
            `UPDATE auto_apply_queue 
       SET status = 'skipped', error_message = $3
       WHERE id = $1 AND user_id = $2`,
            [queueId, userId, reason]
        );

        if (result.rowCount === 0) {
            throw new Error('FORBIDDEN: Queue item not found or does not belong to user');
        }

        console.log(`⏭️ Skipped queue item ${queueId}: ${reason}`);
    }

    /**
     * Log auto-apply action
     */
    async logAction({ queueId, userId, vacancyId, actionType, selector, valueKey, success, errorMessage, durationMs }) {
        await db.query(
            `INSERT INTO auto_apply_logs 
       (queue_id, user_id, vacancy_id, action_type, selector, value_key, success, error_message, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [queueId, userId, vacancyId, actionType, selector, valueKey, success, errorMessage, durationMs]
        );
    }

    /**
     * Get user's queue
     */
    async getUserQueue(userId) {
        const result = await db.query(
            `SELECT q.*, v.title, v.company_name, v.source
       FROM auto_apply_queue q
       JOIN vacancies v ON q.vacancy_id = v.id
       WHERE q.user_id = $1
       ORDER BY q.priority DESC, q.created_at DESC`,
            [userId]
        );

        return result.rows;
    }

    /**
     * Reset stale processing items (cron job)
     */
    async resetStaleItems() {
        const result = await db.query(
            `UPDATE auto_apply_queue
       SET status = 'pending'
       WHERE status = 'processing' 
       AND started_at < CURRENT_TIMESTAMP - INTERVAL '10 minutes'
       RETURNING id`,
            []
        );

        if (result.rows.length > 0) {
            console.log(`🔄 Reset ${result.rows.length} stale queue items`);
        }

        return result.rows.length;
    }
}

// Singleton instance
const autoApplyExecutor = new AutoApplyExecutor();

module.exports = autoApplyExecutor;
