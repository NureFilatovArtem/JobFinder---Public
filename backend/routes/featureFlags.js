/**
 * Feature Flags Routes
 *
 * GET /api/feature-flags/:key   — read flag value (authenticated)
 * PUT /api/feature-flags/:key   — set flag value (admin/owner only)
 */

const express = require('express');
const router = express.Router();
const { getFeatureFlag, setFeatureFlag } = require('../services/featureFlags');
const { checkIsAdmin } = require('../middleware/auth');

/**
 * GET /api/feature-flags/:key
 * Returns the boolean value of a feature flag.
 * Returns false if key does not exist.
 */
router.get('/:key', async (req, res) => {
    try {
        const { key } = req.params;

        if (!key || typeof key !== 'string') {
            return res.status(400).json({ error: 'Invalid key' });
        }

        const value = await getFeatureFlag(key);
        res.json({ key, value });
    } catch (error) {
        console.error('Error reading feature flag:', error.message);
        res.status(500).json({ error: 'Failed to read feature flag' });
    }
});

/**
 * PUT /api/feature-flags/:key
 * Sets the boolean value of a feature flag.
 * Admin/owner only.
 */
router.put('/:key', checkIsAdmin, async (req, res) => {
    try {
        const { key } = req.params;
        const { value } = req.body;

        if (!key || typeof key !== 'string') {
            return res.status(400).json({ error: 'Invalid key' });
        }

        if (typeof value !== 'boolean') {
            return res.status(400).json({ error: 'value must be a boolean' });
        }

        // TODO: Audit log — record req.user.id, key, old value, new value, timestamp
        await setFeatureFlag(key, value);

        console.log(`🏳️ Feature flag '${key}' set to ${value} by user ${req.user?.id}`);

        res.json({ key, value, updated: true });
    } catch (error) {
        console.error('Error setting feature flag:', error.message);
        res.status(500).json({ error: 'Failed to set feature flag' });
    }
});

module.exports = router;
