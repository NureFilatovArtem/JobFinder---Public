/**
 * Asset Activation Service
 * Handles atomic activation/deactivation of application assets
 */

const db = require('../database/postgres');

class AssetActivationService {
    /**
     * Activate a specific asset (deactivates others of same type)
     * @param {string} assetId - UUID of asset to activate
     * @param {number} userId - Authenticated user ID (ownership enforcement)
     * @returns {Promise<boolean>}
     */
    async activateAsset(assetId, userId) {
        if (!userId) throw new Error('userId is required for activateAsset');
        const client = await db.getClient();

        try {
            await client.query('BEGIN');

            // Get asset details — enforce ownership at SQL level
            const assetResult = await client.query(
                'SELECT user_id, vacancy_id, type FROM application_assets WHERE id = $1 AND user_id = $2',
                [assetId, userId]
            );

            if (assetResult.rowCount === 0) {
                await client.query('ROLLBACK');
                throw new Error('FORBIDDEN: Asset not found or does not belong to user');
            }

            const { vacancy_id, type } = assetResult.rows[0];

            // Deactivate all assets of same type for same vacancy (scoped to user)
            await client.query(
                `UPDATE application_assets 
         SET is_active = false 
         WHERE user_id = $1 AND vacancy_id = $2 AND type = $3`,
                [userId, vacancy_id, type]
            );

            // Activate target asset (scoped to user)
            await client.query(
                'UPDATE application_assets SET is_active = true WHERE id = $1 AND user_id = $2',
                [assetId, userId]
            );

            await client.query('COMMIT');

            console.log(`✅ Activated asset ${assetId} (type: ${type})`);
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Failed to activate asset:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Deactivate a specific asset
     * @param {string} assetId - UUID of asset to deactivate
     * @param {number} userId - Authenticated user ID (ownership enforcement)
     * @returns {Promise<boolean>}
     */
    async deactivateAsset(assetId, userId) {
        if (!userId) throw new Error('userId is required for deactivateAsset');
        const result = await db.query(
            'UPDATE application_assets SET is_active = false WHERE id = $1 AND user_id = $2 RETURNING id',
            [assetId, userId]
        );

        if (result.rowCount === 0) {
            throw new Error('FORBIDDEN: Asset not found or does not belong to user');
        }

        console.log(`✅ Deactivated asset ${assetId}`);
        return true;
    }

    /**
     * Get active asset for a specific vacancy and type
     * @param {number} userId - User ID
     * @param {number} vacancyId - Vacancy ID
     * @param {string} assetType - 'resume', 'cover_letter', or 'follow_up'
     * @returns {Promise<Object|null>}
     */
    async getActiveAsset(userId, vacancyId, assetType) {
        const result = await db.query(
            `SELECT * FROM application_assets 
       WHERE user_id = $1 AND vacancy_id = $2 AND type = $3 AND is_active = true
       ORDER BY created_at DESC LIMIT 1`,
            [userId, vacancyId, assetType]
        );

        return result.rows[0] || null;
    }

    /**
     * Get all assets for a vacancy (grouped by type)
     * @param {number} userId - User ID
     * @param {number} vacancyId - Vacancy ID
     * @returns {Promise<Object>}
     */
    async getVacancyAssets(userId, vacancyId) {
        const result = await db.query(
            `SELECT * FROM application_assets 
       WHERE user_id = $1 AND vacancy_id = $2
       ORDER BY type, created_at DESC`,
            [userId, vacancyId]
        );

        const grouped = {
            resume: [],
            cover_letter: [],
            follow_up: []
        };

        result.rows.forEach(asset => {
            if (grouped[asset.type]) {
                grouped[asset.type].push(asset);
            }
        });

        return grouped;
    }
}

// Singleton instance
const assetActivation = new AssetActivationService();

module.exports = assetActivation;
