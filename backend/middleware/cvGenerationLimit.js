/**
 * CV Generation Rate Limit Middleware
 *
 * Enforces a daily limit on CV/PDF generation per user.
 * Uses a single atomic conditional UPDATE — no SELECT+UPDATE race condition.
 *
 * Applied to:
 *   - POST /api/resume/generate
 *   - POST /api/resume/regenerate-pdf
 *
 * NOT applied to editing, template switching, uploads, or deletes.
 */

const { db } = require('../database');

const CV_GENERATION_LIMIT = 5;

const cvGenerationLimit = async (req, res, next) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const userId = req.user.id;

        // Atomic conditional UPDATE — covers three disjoint cases:
        //   a) last_cv_generation_date IS NULL   → first ever generation, set counter to 1
        //   b) last_cv_generation_date < today    → new day, reset counter to 1
        //   c) last_cv_generation_date = today AND counter < limit → same day, increment
        //
        // If none match (same day, counter >= limit) → 0 rows returned → reject.
        // This guarantees safety even under extreme concurrency.
        const result = await db.query(
            `UPDATE users
             SET
               cv_generations_today = CASE
                 WHEN last_cv_generation_date IS NULL
                      OR last_cv_generation_date < CURRENT_DATE
                   THEN 1
                 ELSE cv_generations_today + 1
               END,
               last_cv_generation_date = CURRENT_DATE
             WHERE id = $1
               AND (
                 last_cv_generation_date IS NULL
                 OR last_cv_generation_date < CURRENT_DATE
                 OR (
                     last_cv_generation_date = CURRENT_DATE
                     AND cv_generations_today < $2
                 )
               )
             RETURNING cv_generations_today`,
            [userId, CV_GENERATION_LIMIT]
        );

        if (result.rows.length === 0) {
            return res.status(429).json({
                error: 'Daily CV generation limit reached',
                errorCode: 'CV_LIMIT_REACHED',
                limit: CV_GENERATION_LIMIT,
                message: `You can generate up to ${CV_GENERATION_LIMIT} CVs per day. Try again tomorrow.`
            });
        }

        // Defensive overflow guard — should never fire under normal operation,
        // but guarantees safety even if DB state is somehow corrupted.
        // This guarantees safety even under extreme concurrency.
        const used = result.rows[0].cv_generations_today;
        if (used > CV_GENERATION_LIMIT) {
            console.error(`⚠️ CV limit overflow detected: user=${userId}, count=${used}`);
            return res.status(429).json({
                error: 'Daily CV generation limit reached',
                errorCode: 'CV_LIMIT_REACHED',
                limit: CV_GENERATION_LIMIT
            });
        }

        req.cvGenerationsUsed = used;
        req.cvGenerationsRemaining = CV_GENERATION_LIMIT - used;
        next();
    } catch (error) {
        console.error('❌ CV generation limit error:', error.message);
        return res.status(500).json({ error: 'Rate limit check failed' });
    }
};

module.exports = cvGenerationLimit;
