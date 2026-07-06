/**
 * Vacancy Import Routes
 * 
 * Handles importing vacancies from external sources (LinkedIn extension, etc.)
 * All routes require admin/owner role
 */

const express = require('express');
const router = express.Router();
const { dbHelpers } = require('../database');
const { sanitizeVacancyData, validateVacancyImport } = require('../services/inputSanitizer');
const authMiddleware = require('../middleware/auth');
const { checkIsAdmin } = require('../middleware/auth');

// Apply auth + admin check to ALL routes in this router
router.use(authMiddleware);
router.use(checkIsAdmin);

/**
 * POST /api/vacancies/import
 * Import vacancies from extension (LinkedIn, etc.)
 * 
 * Body: {
 *   vacancies: [{
 *     title: string,
 *     company: string,
 *     location: string,
 *     source_url: string,
 *     source_id: string,
 *     source: 'linkedin' | 'indeed' | etc.,
 *     description?: string
 *   }],
 *   source: string
 * }
 */
router.post('/', async (req, res) => {
    try {
        const { vacancies, source } = req.body;

        // Validate input
        if (!Array.isArray(vacancies)) {
            return res.status(400).json({
                error: 'Invalid request',
                message: 'vacancies must be an array'
            });
        }

        if (vacancies.length === 0) {
            return res.json({
                success: true,
                imported: 0,
                duplicates: 0,
                message: 'No vacancies to import'
            });
        }

        if (vacancies.length > 100) {
            return res.status(400).json({
                error: 'Too many vacancies',
                message: 'Maximum 100 vacancies per request'
            });
        }

        console.log(`[Import] Received ${vacancies.length} vacancies from ${source || 'unknown'}`);

        // Validate and sanitize each vacancy
        const validVacancies = [];
        const invalidVacancies = [];

        for (const vac of vacancies) {
            const validation = validateVacancyImport(vac);
            if (!validation.isValid) {
                invalidVacancies.push({ vacancy: vac, errors: validation.errors });
                continue;
            }

            const sanitized = sanitizeVacancyData(vac);
            if (sanitized.hasBlockedContent) {
                invalidVacancies.push({
                    vacancy: vac,
                    errors: ['Contains blocked content']
                });
                continue;
            }

            // Normalize data
            validVacancies.push({
                title: sanitized.data.title,
                company: sanitized.data.company || '',
                company_name: sanitized.data.company || '',
                location: sanitized.data.location || '',
                description: sanitized.data.description || '',
                source_url: sanitized.data.source_url,
                link: sanitized.data.source_url,
                source_id: sanitized.data.source_id || generateSourceId(sanitized.data),
                source: sanitized.data.source || source || 'import',
                status: 'gevonden',
                scraped_at: new Date().toISOString()
            });
        }

        if (validVacancies.length === 0) {
            return res.status(400).json({
                error: 'No valid vacancies',
                message: 'All vacancies failed validation',
                invalidCount: invalidVacancies.length,
                invalidVacancies: invalidVacancies.slice(0, 5) // Show first 5 errors
            });
        }

        // Import using existing bulk create (handles deduplication via upsert)
        const imported = await dbHelpers.createMultipleVacatures(validVacancies);

        console.log(`[Import] Successfully imported ${imported.length} vacancies`);

        res.json({
            success: true,
            imported: imported.length,
            duplicates: validVacancies.length - imported.length,
            invalid: invalidVacancies.length,
            message: `Imported ${imported.length} vacancies`
        });

    } catch (error) {
        console.error('[Import] Error importing vacancies:', error);
        res.status(500).json({
            error: 'Import failed',
            message: error.message
        });
    }
});

/**
 * Generate a source_id from vacancy data if not provided
 */
function generateSourceId(vacancy) {
    const titlePart = (vacancy.title || '').substring(0, 30).replace(/\s+/g, '_');
    const companyPart = (vacancy.company || '').substring(0, 20).replace(/\s+/g, '_');
    const timestamp = Date.now();
    return `${vacancy.source || 'import'}_${titlePart}_${companyPart}_${timestamp}`;
}

/**
 * GET /api/vacancies/import/stats
 * Get import statistics by source
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await dbHelpers.getVacancyStatsBySource();
        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('[Import] Error getting stats:', error);
        res.status(500).json({
            error: 'Failed to get stats',
            message: error.message
        });
    }
});

module.exports = router;
