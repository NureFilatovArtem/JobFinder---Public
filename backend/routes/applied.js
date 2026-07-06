// Applied vacatures API routes
const express = require('express');
const router = express.Router();
const { dbHelpers } = require('../database');

// GET /api/applied - Get all applied vacatures
router.get('/', (req, res) => {
  try {
    const applied = dbHelpers.getAppliedVacatures();
    res.json({ success: true, data: applied });
  } catch (error) {
    console.error('Error fetching applied vacatures:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/applied - Mark vacature as applied
router.post('/', (req, res) => {
  try {
    const { vacatureId } = req.body;

    if (!vacatureId) {
      return res.status(400).json({ success: false, error: 'vacatureId is required' });
    }

    const vacature = dbHelpers.getVacatureById(vacatureId);
    if (!vacature) {
      return res.status(404).json({ success: false, error: 'Vacature not found' });
    }

    const applied = dbHelpers.markAsApplied(vacatureId);
    res.json({ success: true, data: applied });
  } catch (error) {
    console.error('Error marking vacature as applied:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/applied/:id - Check if vacature is applied
router.get('/:id', (req, res) => {
  try {
    const isApplied = dbHelpers.isApplied(req.params.id);
    res.json({ success: true, data: { isApplied } });
  } catch (error) {
    console.error('Error checking applied status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

