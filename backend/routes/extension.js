// Extension routes - for receiving jobs from Chrome extension
const express = require('express');
const router = express.Router();
const { db } = require('../database');
const authMiddleware = require('../middleware/auth'); // Use centralized middleware

// Middleware to check extension token or user session
// For now, we reuse the user auth middleware but in real extension use-case 
// it might use a specialized API Key + User ID logic.
// The prompt says "Returns next pending item WHERE user_id = req.user.id"
// So standard auth is expected.

router.get('/next', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get the oldest pending item with highest priority
    // Using source_url which is the correct column in schema_v2
    const result = await db.query(`
            SELECT q.*, v.source_url as original_link
            FROM auto_apply_queue q
            JOIN vacancies v ON q.vacancy_id = v.id
            WHERE q.user_id = $1 AND q.status = 'pending'
            ORDER BY q.priority DESC, q.created_at ASC
            LIMIT 1
        `, [userId]);

    if (result.rows.length === 0) {
      return res.status(204).send(); // No content
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Extension /next error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST receive jobs from Chrome extension — requires auth
router.post('/jobs', authMiddleware, async (req, res) => {
  try {
    const { jobs } = req.body;

    if (!Array.isArray(jobs)) {
      return res.status(400).json({ error: 'jobs must be an array' });
    }

    // Clean and validate jobs
    const cleanedJobs = jobs.map(job => {
      // Ensure required fields
      if (!job.title) {
        return null; // Skip invalid jobs
      }

      // Ensure URL is valid
      let link = job.link || '';
      if (link) {
        try {
          // Validate URL
          new URL(link);
        } catch (e) {
          // If invalid, try to construct from source
          if (job.source === 'indeed' && link) {
            link = link.startsWith('http') ? link : `https://be.indeed.com${link.startsWith('/') ? link : '/' + link}`;
          } else if (job.source === 'vdab' && link) {
            link = link.startsWith('http') ? link : `https://www.vdab.be${link.startsWith('/') ? link : '/' + link}`;
          } else if (job.source === 'stepstone' && link) {
            link = link.startsWith('http') ? link : `https://www.stepstone.be${link.startsWith('/') ? link : '/' + link}`;
          } else if (job.source === 'antwerpen' && link) {
            link = link.startsWith('http') ? link : `https://www.antwerpen.be${link.startsWith('/') ? link : '/' + link}`;
          } else {
            link = ''; // Invalid link
          }
        }
      }

      // Ensure description is included (up to 1500 chars)
      let description = job.description || '';
      if (description.length > 1500) {
        description = description.substring(0, 1500);
      }

      // Extract postcode from location
      let postcode = '';
      if (job.location) {
        const postcodeMatch = job.location.match(/\b(2000|2018|2060|2600|2100|2140)\b/);
        if (postcodeMatch) {
          postcode = postcodeMatch[1];
        }
      }

      return {
        title: job.title.trim(),
        company: (job.company || '').trim(),
        location: (job.location || '').trim(),
        description: description.trim(),
        link: link,
        source: job.source || 'unknown',
        status: 'gevonden',
        job_type: job.job_type || '',
        postcode: postcode
      };
    }).filter(job => job !== null); // Remove invalid jobs

    if (cleanedJobs.length === 0) {
      return res.status(400).json({ error: 'No valid jobs provided' });
    }

    // Save to database — global vacancies (not user-scoped)
    const { dbHelpers } = require('../database');
    const savedJobs = await dbHelpers.createMultipleVacatures(cleanedJobs);

    res.json({
      success: true,
      count: savedJobs.length,
      message: `${savedJobs.length} vacatures opgeslagen`,
      jobs: savedJobs
    });
  } catch (error) {
    console.error('Error saving jobs from extension:', error);
    res.status(500).json({ error: 'Failed to save jobs', message: error.message });
  }
});

module.exports = router;

