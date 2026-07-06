// Motivation letter generation routes
const express = require('express');
const router = express.Router();
const geminiService = require('../services/geminiService');
const { dbHelpers } = require('../database');
const authenticateToken = require('../middleware/auth');

// POST generate motivation letters for up to 5 vacatures — requires auth
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { vacatureIds, profile } = req.body;
    const userId = req.user.id;

    console.log('Motivation generation request:', { vacatureIds, profile: profile ? 'provided' : 'missing' });

    if (!vacatureIds || !Array.isArray(vacatureIds)) {
      return res.status(400).json({ error: 'vacatureIds must be an array' });
    }

    if (vacatureIds.length === 0 || vacatureIds.length > 5) {
      return res.status(400).json({ error: 'Must provide 1-5 vacature IDs' });
    }

    if (!profile) {
      return res.status(400).json({ error: 'Profile is required' });
    }

    // Ensure profile has required fields with defaults
    const profileData = {
      name: profile.name || 'Kandidaat',
      skills: profile.skills || 'Niet gespecificeerd',
      personality: profile.personality || 'Niet gespecificeerd',
      availability: profile.availability || 'Flexibel beschikbaar'
    };

    console.log('Using profile:', profileData);

    // Fetch vacatures from database
    const vacatures = await Promise.all(
      vacatureIds.map(id => dbHelpers.getVacatureById(id))
    );

    // Filter out any null results
    const validVacatures = vacatures.filter(v => v !== undefined && v !== null);

    console.log(`Found ${validVacatures.length} valid vacatures out of ${vacatureIds.length} requested`);

    if (validVacatures.length === 0) {
      return res.status(404).json({ error: 'No valid vacatures found for the provided IDs' });
    }

    // Generate motivations using Gemini
    console.log('Calling Gemini service to generate motivations...');
    const results = await geminiService.generateMotivations(validVacatures, profileData);
    console.log(`Generated ${results.length} motivation letters`);

    // Update database with generated motivations — scoped to authenticated user
    for (const result of results) {
      try {
        if (result.id && result.letter) {
          await dbHelpers.updateVacatureMotivation(userId, result.id, result.letter);
          console.log(`Updated motivation for vacature ${result.id}`);
        } else {
          console.warn('Invalid result format:', result);
        }
      } catch (error) {
        console.error(`Error updating motivation for vacature ${result.id}:`, error);
      }
    }

    res.json({ success: true, results });
  } catch (error) {
    console.error('Error generating motivations:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: 'Failed to generate motivations',
      message: error.message || 'An unknown error occurred',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
