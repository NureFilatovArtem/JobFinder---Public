const express = require('express');
const router = express.Router();
const { dbHelpers } = require('../database');

// GET /api/blocked-organizations - List all blocked orgs for current user
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const blockedOrgs = await dbHelpers.getBlockedOrganizations(userId);
        res.json(blockedOrgs);
    } catch (error) {
        console.error('Error fetching blocked organizations:', error);
        res.status(500).json({ error: 'Failed to fetch blocked organizations' });
    }
});

// POST /api/blocked-organizations - Block a company
router.post('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const { companyName, reason } = req.body;

        if (!companyName || !companyName.trim()) {
            return res.status(400).json({ error: 'Company name is required' });
        }

        if (companyName.trim().length > 500) {
            return res.status(400).json({ error: 'Company name too long (max 500 chars)' });
        }

        const blocked = await dbHelpers.blockOrganization(userId, companyName, reason);

        if (!blocked) {
            return res.json({
                success: true,
                message: 'Organization already blocked',
                alreadyBlocked: true
            });
        }

        res.status(201).json({
            success: true,
            blockedOrganization: blocked
        });
    } catch (error) {
        console.error('Error blocking organization:', error);
        res.status(500).json({ error: 'Failed to block organization' });
    }
});

// DELETE /api/blocked-organizations/:id - Unblock a company
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const blockedOrgId = parseInt(req.params.id);

        const unblocked = await dbHelpers.unblockOrganization(userId, blockedOrgId);

        if (!unblocked) {
            return res.status(404).json({ error: 'Blocked organization not found' });
        }

        res.json({
            success: true,
            unblocked: unblocked
        });
    } catch (error) {
        console.error('Error unblocking organization:', error);
        res.status(500).json({ error: 'Failed to unblock organization' });
    }
});

module.exports = router;
