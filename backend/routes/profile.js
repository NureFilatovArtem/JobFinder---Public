// Profile routes
const express = require('express');
const router = express.Router();
const { dbHelpers } = require('../database');
const authenticateToken = require('../middleware/auth');

// GET profile — scoped to authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const profile = await dbHelpers.getProfile(req.user.id);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json(profile);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// POST/PUT update profile — scoped to authenticated user
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { skills, tags, personality, availability, name } = req.body;

    const profile = await dbHelpers.updateProfile(req.user.id, {
      skills: skills || '', // Keep for backward compatibility
      tags: tags || [],     // New tag-based system
      personality: personality || '',
      availability: availability || 'vrijdag, zaterdag, zondag (8:00–19:00)',
      name: name || ''
    });

    res.json(profile);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.put('/', authenticateToken, async (req, res) => {
  try {
    const { skills, tags, personality, availability, name } = req.body;

    const profile = await dbHelpers.updateProfile(req.user.id, {
      skills: skills || '', // Keep for backward compatibility
      tags: tags || [],     // New tag-based system
      personality: personality || '',
      availability: availability || 'vrijdag, zaterdag, zondag (8:00–19:00)',
      name: name || ''
    });

    res.json(profile);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
