/**
 * Assets API Routes
 * Handles asset generation, upload, activation, and retrieval
 */

const express = require('express');
const router = express.Router();
const assetGenerator = require('../services/assetGenerator');
const assetActivation = require('../services/assetActivation');
const authenticateToken = require('../middleware/auth');

/**
 * POST /api/assets/generate
 * Generate job-specific asset (resume, cover letter, follow-up)
 */
router.post('/generate', authenticateToken, async (req, res) => {
    try {
        const { vacancy_id, asset_type, template_id } = req.body;
        const userId = req.user.id;

        // Validate required fields
        if (!vacancy_id || !asset_type) {
            return res.status(400).json({
                error: 'Missing required fields: vacancy_id, asset_type'
            });
        }

        // Validate asset type
        const validTypes = ['resume', 'cover_letter', 'follow_up'];
        if (!validTypes.includes(asset_type)) {
            return res.status(400).json({
                error: `Invalid asset_type. Must be one of: ${validTypes.join(', ')}`
            });
        }

        console.log(`📝 Generating ${asset_type} for user ${userId}, vacancy ${vacancy_id}`);

        const result = await assetGenerator.generateAsset({
            userId,
            vacancyId: vacancy_id,
            assetType: asset_type,
            templateId: template_id || null
        });

        res.json({
            success: true,
            pdf_asset_id: result.pdfAssetId,
            docx_asset_id: result.docxAssetId,
            pdf_url: result.pdfUrl,
            docx_url: result.docxUrl
        });
    } catch (error) {
        console.error('Asset generation error:', error);
        res.status(500).json({
            error: error.message || 'Failed to generate asset'
        });
    }
});

/**
 * POST /api/assets/upload
 * Upload user's own asset file
 */
router.post('/upload', authenticateToken, async (req, res) => {
    try {
        // TODO: Implement file upload with multer
        // For now, return not implemented
        res.status(501).json({
            error: 'File upload not yet implemented'
        });
    } catch (error) {
        console.error('Asset upload error:', error);
        res.status(500).json({
            error: error.message || 'Failed to upload asset'
        });
    }
});

/**
 * PUT /api/assets/:id/activate
 * Activate a specific asset (deactivates others of same type)
 * Ownership enforced at SQL level
 */
router.put('/:id/activate', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        await assetActivation.activateAsset(id, userId);

        res.json({
            success: true,
            message: 'Asset activated successfully'
        });
    } catch (error) {
        if (error.message.includes('FORBIDDEN')) {
            return res.status(403).json({ error: 'Access denied: asset does not belong to you' });
        }
        console.error('Asset activation error:', error);
        res.status(500).json({
            error: error.message || 'Failed to activate asset'
        });
    }
});

/**
 * GET /api/assets
 * Get assets for a vacancy
 * Query params: vacancy_id (required)
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { vacancy_id } = req.query;
        const userId = req.user.id;

        if (!vacancy_id) {
            return res.status(400).json({
                error: 'Missing required query parameter: vacancy_id'
            });
        }

        const assets = await assetActivation.getVacancyAssets(userId, parseInt(vacancy_id));

        res.json({
            success: true,
            assets
        });
    } catch (error) {
        console.error('Get assets error:', error);
        res.status(500).json({
            error: error.message || 'Failed to retrieve assets'
        });
    }
});

/**
 * DELETE /api/assets/:id
 * Deactivate an asset
 * Ownership enforced at SQL level
 */
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        await assetActivation.deactivateAsset(id, userId);

        res.json({
            success: true,
            message: 'Asset deactivated successfully'
        });
    } catch (error) {
        if (error.message.includes('FORBIDDEN')) {
            return res.status(403).json({ error: 'Access denied: asset does not belong to you' });
        }
        console.error('Asset deactivation error:', error);
        res.status(500).json({
            error: error.message || 'Failed to deactivate asset'
        });
    }
});

module.exports = router;
