// Vacatures routes
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { db, dbHelpers } = require('../database');
const geminiService = require('../services/geminiService');
const authenticateToken = require('../middleware/auth');

// GET all vacatures (with optional status filter)
// Uses optional auth — if token present, scopes user-specific data
router.get('/', async (req, res) => {
  try {
    const { status, autoApplyOnly } = req.query;

    // Optional auth: extract userId if token is present (for blocked org filtering & personalization)
    let userId = null;
    let token = req.cookies?.access_token;
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
      } catch (e) {
        // Invalid token, continue without user context
      }
    }

    let vacatures;

    if (status) {
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required to filter by status' });
      }
      vacatures = await dbHelpers.getVacaturesByStatus(status, userId);
    } else {
      const filters = {};
      if (autoApplyOnly === 'true') {
        filters.sources = ['indeed', 'linkedin'];
      }
      vacatures = await dbHelpers.getAllVacatures(filters, userId);
    }

    console.log(`🔍 [GET /] Fetched ${vacatures.length} vacatures from DB.`);

    // Filter out mock/test data from database
    const realVacatures = vacatures.filter(vac => {
      // Remove mock vacancies
      if (vac.source === 'mock') return false;
      if (vac.link && (
        vac.link.includes('example.com') ||
        vac.link.includes('test.com') ||
        vac.link.includes('mock')
      )) {
        return false;
      }
      if (vac.title && (
        vac.title.toLowerCase().includes('test') ||
        vac.title.toLowerCase().includes('mock') ||
        vac.title.toLowerCase().includes('example')
      )) {
        return false;
      }
      return true;
    });

    console.log(`✅ [GET /] Returning ${realVacatures.length} real vacatures.`);
    res.json(realVacatures);
  } catch (error) {
    console.error('Error fetching vacatures:', error);
    res.status(500).json({ error: 'Failed to fetch vacatures' });
  }
});

// GET vacature by ID
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const vacature = await dbHelpers.getVacatureById(id);
    if (!vacature) {
      return res.status(404).json({ error: 'Vacature not found' });
    }
    res.json(vacature);
  } catch (error) {
    console.error('Error fetching vacature:', error);
    res.status(500).json({ error: 'Failed to fetch vacature' });
  }
});

// POST create vacature
router.post('/', async (req, res) => {
  try {
    const { title, company, location, description, link, source, status, job_type, postcode } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const vacature = await dbHelpers.createVacature({
      title,
      company: company || '',
      location: location || '',
      description: description || '',
      link: link || '',
      source: source || '',
      status: status || 'gevonden',
      job_type: job_type || '',
      postcode: postcode || ''
    });

    res.status(201).json(vacature);
  } catch (error) {
    console.error('Error creating vacature:', error);
    res.status(500).json({ error: 'Failed to create vacature' });
  }
});

// POST create multiple vacatures
router.post('/bulk', async (req, res) => {
  try {
    const { vacatures } = req.body;

    if (!Array.isArray(vacatures)) {
      return res.status(400).json({ error: 'vacatures must be an array' });
    }

    const created = await dbHelpers.createMultipleVacatures(vacatures);
    res.status(201).json({ count: created.length, vacatures: created });
  } catch (error) {
    console.error('Error creating vacatures:', error);
    res.status(500).json({ error: 'Failed to create vacatures' });
  }
});

// PUT update vacature motivation — requires auth, scoped by user
router.put('/:id/motivation', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { motivation } = req.body;

    if (!motivation) {
      return res.status(400).json({ error: 'Motivation is required' });
    }

    const result = await dbHelpers.updateVacatureMotivation(req.user.id, id, motivation);
    if (!result) {
      return res.status(404).json({ error: 'Vacature not found' });
    }
    res.json({ id, motivation });
  } catch (error) {
    console.error('Error updating motivation:', error);
    res.status(500).json({ error: 'Failed to update motivation' });
  }
});

// PATCH update vacature status — requires auth, scoped by user
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatuses = ['gevonden', 'toegepast', 'niet_interessant', 'interessant'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be one of: ' + validStatuses.join(', ') });
    }

    // Update user-vacancy score to reflect status
    await dbHelpers.setUserVacancyScore(req.user.id, id, { application_status: status });
    res.json({ id, status });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// POST /match-all - Trigger AI matching for vacancies — requires auth
router.post('/match-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, force = false } = req.body;

    console.log('🚀 Starting AI Batch Matching...');

    // 1. Get User Profile — scoped to authenticated user
    const profile = await dbHelpers.getProfile(userId);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found. Please create a profile first.' });
    }

    // Try to use the user's built CV for richer matching
    const resumeResult = await db.query(
      "SELECT canonical_text, skills, work_experience, languages, summary, location FROM resumes WHERE user_id = $1 AND status = 'ready'",
      [userId]
    );
    const resume = resumeResult.rows[0];

    let profileText;
    if (resume && resume.canonical_text && resume.canonical_text.trim().length > 100) {
      console.log('📄 Using built CV (canonical_text) for matching');
      profileText = resume.canonical_text;
    } else if (resume) {
      console.log('📄 Using built CV (structured fields) for matching');
      const skills = Array.isArray(resume.skills)
        ? resume.skills.map(s => (typeof s === 'string' ? s : s?.name || '')).filter(Boolean).join(', ')
        : '';
      const langs = Array.isArray(resume.languages)
        ? resume.languages.map(l => (typeof l === 'string' ? l : l?.language || l?.name || '')).filter(Boolean).join(', ')
        : '';
      const exp = Array.isArray(resume.work_experience)
        ? resume.work_experience.map(e => `${e.title || ''} at ${e.company || ''}`).join('; ')
        : '';
      profileText = [
        resume.summary && `Summary: ${resume.summary}`,
        skills && `Skills: ${skills}`,
        exp && `Experience: ${exp}`,
        langs && `Languages: ${langs}`,
        resume.location && `Location: ${resume.location}`,
      ].filter(Boolean).join('\n');
    } else {
      console.log('⚠️  No CV found — falling back to basic profile for matching');
      profileText = [
        `Name: ${profile.name}`,
        `Skills: ${profile.skills}`,
        `Tags: ${Array.isArray(profile.tags) ? profile.tags.join(', ') : (profile.tags || '')}`,
        `Experience: ${profile.experience || 'Not specified'}`,
        `Languages: ${profile.languages || 'Dutch, English'}`,
        `Preferred Location: ${profile.location || 'Belgium'}`,
      ].join('\n');
    }

    // 2. Get Vacancies scoped to user
    const allVacancies = await dbHelpers.getAllVacatures({}, userId);

    // Filter: either force update ALL, or only those with null/0 score
    const vacanciesToScore = allVacancies.filter(v =>
      force || !v.match_score || v.match_score === 0
    ).slice(0, limit);

    console.log(`📋 Found ${vacanciesToScore.length} vacancies to score.`);

    if (vacanciesToScore.length === 0) {
      return res.json({ message: 'No vacancies need scoring.', count: 0 });
    }

    // 3. Process sequentially — gemini-2.5-flash free tier is 20 req/day
    //    Running in parallel burns through the quota in one burst.
    const results = [];
    let processed = 0;

    for (const vac of vacanciesToScore) {
      console.log(`Scoring vacancy ${processed + 1}/${vacanciesToScore.length} (id ${vac.id})...`);
      try {
        const vacancyText = `Title: ${vac.title}
Company: ${vac.company}
Description: ${vac.description ? vac.description.slice(0, 800) : ''}
Location: ${vac.location}
Contract: ${vac.contract_type}`;

        const result = await geminiService.generateMatchScore(profileText, vacancyText);

        await dbHelpers.setUserVacancyScore(userId, vac.id, {
          match_score: result.score,
          match_details: result.reason
        });

        results.push({ id: vac.id, success: true, score: result.score, reason: result.reason });
        console.log(`✅ Vacancy ${vac.id} scored: ${result.score}`);
      } catch (err) {
        console.error(`❌ Error scoring vacancy ${vac.id}:`, err.message);
        results.push({ id: vac.id, success: false, error: err.message });
      }
      processed++;
    }

    res.json({
      success: true,
      count: processed,
      results: results
    });

  } catch (error) {
    console.error('Error in /match-all:', error);
    res.status(500).json({ error: 'Failed to run matching' });
  }
});

module.exports = router;
