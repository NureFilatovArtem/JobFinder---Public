/**
 * Daily Limit Reset Script
 * Resets auto_applies_used counter for all users daily
 * Should be run as a cron job (e.g., daily at midnight)
 */

const db = require('../database/postgres');

async function resetDailyLimits() {
    try {
        console.log('🔄 Resetting daily auto-apply limits...');

        const result = await db.query(
            `UPDATE users
       SET auto_applies_used = 0,
           auto_applies_reset_at = CURRENT_TIMESTAMP
       WHERE auto_applies_reset_at < CURRENT_TIMESTAMP - INTERVAL '1 day'
       RETURNING id`,
            []
        );

        console.log(`✅ Reset daily limits for ${result.rows.length} users`);
        return result.rows.length;
    } catch (error) {
        console.error('❌ Failed to reset daily limits:', error);
        throw error;
    }
}

async function resetStaleQueueItems() {
    try {
        console.log('🔄 Resetting stale queue items...');

        const result = await db.query(
            `UPDATE auto_apply_queue
       SET status = 'pending'
       WHERE status = 'processing' 
       AND started_at < CURRENT_TIMESTAMP - INTERVAL '10 minutes'
       RETURNING id`,
            []
        );

        console.log(`✅ Reset ${result.rows.length} stale queue items`);
        return result.rows.length;
    } catch (error) {
        console.error('❌ Failed to reset stale queue items:', error);
        throw error;
    }
}

// Run both maintenance tasks
async function runMaintenance() {
    try {
        await resetDailyLimits();
        await resetStaleQueueItems();
        console.log('✅ Maintenance completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Maintenance failed:', error);
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    runMaintenance();
}

module.exports = {
    resetDailyLimits,
    resetStaleQueueItems
};
