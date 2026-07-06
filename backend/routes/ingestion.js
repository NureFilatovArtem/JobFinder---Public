/**
 * Ingestion API routes — admin only.
 *
 * GET  /api/ingestion/status         — show all source configs and enabled state
 * POST /api/ingestion/run            — fire-and-forget background ingestion
 * POST /api/ingestion/run/sync       — run ingestion and wait for result (testing only)
 *
 * All routes require a valid JWT (authMiddleware) AND is_admin = true.
 */

const express          = require('express');
const router           = express.Router();
const authMiddleware   = require('../middleware/auth');
const ingestionPipeline = require('../services/ingestion/IngestionPipeline');
const ingestionSources  = require('../config/ingestionSources');

// Apply auth to every ingestion route
router.use(authMiddleware);

// ─── Admin guard helper ───────────────────────────────────────────────────────
function requireAdmin(req, res) {
  const allowedRoles = ['admin', 'owner'];
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    res.status(403).json({ error: 'Admin access required' });
    return false;
  }
  return true;
}

// ─── GET /api/ingestion/status ────────────────────────────────────────────────
/**
 * Returns the current ingestion configuration:
 *  - Legacy scraper gate state (indeed/linkedin enabled or not)
 *  - Each source: enabled, countries, API key presence, rate limit
 */
router.get('/status', (req, res) => {
  if (!requireAdmin(req, res)) return;

  const sourceSummary = {};
  for (const [name, cfg] of Object.entries(ingestionSources.sources)) {
    sourceSummary[name] = {
      enabled:        cfg.enabled,
      countries:      cfg.countries,
      rateLimit:      cfg.rateLimit,
      retries:        cfg.retries,
      requiresApiKey: 'appId' in cfg || 'apiKey' in cfg,
      apiKeyPresent:  !!(cfg.appId || cfg.apiKey),
      companies:      cfg.companies || null,
    };
  }

  res.json({
    legacy:  ingestionSources.legacy,
    sources: sourceSummary,
  });
});

// ─── POST /api/ingestion/run ──────────────────────────────────────────────────
/**
 * Trigger an ingestion run in the background.
 * Returns immediately with 202 Accepted; watch server logs for progress.
 *
 * Body (all optional):
 *   sources    string[]  e.g. ["adzuna", "forem"]
 *   countries  string[]  e.g. ["BE", "NL"]
 *   keywords   string[]  e.g. ["developer", "hr manager"]
 */
router.post('/run', (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { sources, countries, keywords } = req.body || {};

  // Validate sources if provided
  if (sources && !Array.isArray(sources)) {
    return res.status(400).json({ error: '"sources" must be an array' });
  }
  if (countries && !Array.isArray(countries)) {
    return res.status(400).json({ error: '"countries" must be an array' });
  }
  if (keywords && !Array.isArray(keywords)) {
    return res.status(400).json({ error: '"keywords" must be an array' });
  }

  // Respond immediately — do not block
  res.status(202).json({
    status:  'started',
    message: 'Ingestion running in background. Monitor server logs for progress.',
    options: { sources: sources || 'all', countries: countries || ['BE', 'NL'], keywords: keywords || 'default' },
  });

  setImmediate(async () => {
    try {
      const telemetry = await ingestionPipeline.run({ sources, countries, keywords });
      console.log('[Ingestion] Background run complete:', JSON.stringify(telemetry));
    } catch (err) {
      console.error('[Ingestion] Background run error:', err.message);
    }
  });
});

// ─── POST /api/ingestion/run/sync ─────────────────────────────────────────────
/**
 * Trigger ingestion and wait for the result.
 * ⚠ Only use this for small-scope testing (single source + 1-2 keywords).
 * For production runs, prefer /run (fire-and-forget).
 *
 * Body: same as /run
 */
router.post('/run/sync', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { sources, countries, keywords } = req.body || {};

  try {
    const telemetry = await ingestionPipeline.run({ sources, countries, keywords });
    res.json({ status: 'complete', telemetry });
  } catch (err) {
    console.error('[Ingestion] Sync run error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
