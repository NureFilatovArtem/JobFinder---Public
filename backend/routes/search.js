// Search routes with real web scraping
const express = require('express');
const router = express.Router();
const { dbHelpers } = require('../database');
const scraperService = require('../services/scraperService');
const { sanitizeSearchQuery } = require('../services/inputSanitizer');

// POST search vacatures (returns results without saving)
router.post('/', async (req, res) => {
  try {
    const { keywords, regions, jobTypes, count, country } = req.body;

    if (!keywords || keywords.trim() === '') {
      return res.status(400).json({ error: 'Keywords are required' });
    }

    // Sanitize and validate keywords
    const sanitized = sanitizeSearchQuery(keywords);
    if (!sanitized.isValid) {
      return res.status(400).json({
        error: 'Invalid search query',
        message: sanitized.error,
        blockedWords: sanitized.blockedWords
      });
    }

    // Increase default max results for better coverage
    const maxResults = count || 80;
    const selectedRegions = regions || [];
    const selectedJobTypes = jobTypes || [];

    console.log(`Searching for: "${sanitized.sanitized}" (${sanitized.detectedLanguage}) in regions: ${selectedRegions.join(', ')} (max results: ${maxResults})`);

    // Search all job sites with advanced search (synonyms, combinations)
    const jobs = await scraperService.searchAllSites(
      sanitized.sanitized,
      selectedRegions,
      selectedJobTypes,
      maxResults,
      country
    );

    res.json({
      success: true,
      count: jobs.length,
      detectedLanguage: sanitized.detectedLanguage,
      vacatures: jobs
    });
  } catch (error) {
    console.error('Error searching vacatures:', error);
    res.status(500).json({ error: 'Failed to search vacatures', message: error.message });
  }
});


// POST search and save vacatures
router.post('/save', async (req, res) => {
  try {
    const { keywords, regions, jobTypes, count, country } = req.body;

    if (!keywords || keywords.trim() === '') {
      return res.status(400).json({ error: 'Keywords are required' });
    }

    // Sanitize and validate keywords
    const sanitized = sanitizeSearchQuery(keywords);
    if (!sanitized.isValid) {
      return res.status(400).json({
        error: 'Invalid search query',
        message: sanitized.error,
        blockedWords: sanitized.blockedWords
      });
    }

    // Increase default max results for better coverage
    const maxResults = count || 80;
    const selectedRegions = regions || [];
    const selectedJobTypes = jobTypes || [];

    console.log(`Searching and saving: "${sanitized.sanitized}" (${sanitized.detectedLanguage}) in regions: ${selectedRegions.join(', ')} (max results: ${maxResults})`);

    // Set a timeout for the entire search operation (increased for more searches)
    const searchPromise = scraperService.searchAllSites(
      sanitized.sanitized,
      selectedRegions,
      selectedJobTypes,
      maxResults,
      country
    );

    // Increased timeout for advanced search with multiple queries
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Search operation timed out after 5 minutes')), 300000)
    );

    let jobs = [];
    try {
      jobs = await Promise.race([searchPromise, timeoutPromise]);
    } catch (error) {
      console.error('Error during search:', error);
      return res.status(500).json({
        error: 'Search failed',
        message: error.message || 'An error occurred while searching. Please try again.',
        vacatures: []
      });
    }

    if (jobs.length === 0) {
      return res.json({
        success: true,
        count: 0,
        message: 'Geen vacatures gevonden met deze filters. Probeer andere zoekwoorden.',
        vacatures: []
      });
    }

    // Save to database
    let savedJobs = [];
    try {
      savedJobs = await dbHelpers.createMultipleVacatures(jobs);
    } catch (dbError) {
      console.error('Error saving to database:', dbError);
      return res.status(500).json({
        error: 'Failed to save jobs',
        message: 'Jobs were found but could not be saved to database.',
        vacatures: jobs // Return jobs even if save failed
      });
    }

    res.json({
      success: true,
      count: savedJobs.length,
      message: `${savedJobs.length} vacatures opgeslagen`,
      vacatures: savedJobs
    });
  } catch (error) {
    console.error('Error searching and saving vacatures:', error);
    res.status(500).json({
      error: 'Failed to search and save vacatures',
      message: error.message || 'An unexpected error occurred'
    });
  }
});

module.exports = router;

