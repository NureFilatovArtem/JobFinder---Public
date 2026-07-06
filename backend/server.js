// Main server file
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Import database abstraction layer
const { db, DATABASE_TYPE } = require('./database');

const vacaturesRouter = require('./routes/vacatures');
const motivationRouter = require('./routes/motivation');
const profileRouter = require('./routes/profile');
const searchRouter = require('./routes/search');
const extensionRouter = require('./routes/extension');
const automationRouter = require('./routes/automation');
const autoApplyRouter = require('./routes/autoApply');
const assetsRouter = require('./routes/assets');
const resumeRouter = require('./routes/resume');
const cleanupRouter = require('./routes/cleanup');
const importRouter    = require('./routes/import');
const ingestionRouter = require('./routes/ingestion');
const applicationsRouter = require('./routes/applications');

const blockedOrgsRouter = require('./routes/blockedOrgs');
const authRouter = require('./routes/auth');
const featureFlagsRouter = require('./routes/featureFlags');
const authMiddleware = require('./middleware/auth');
const vacancyCleanupService = require('./services/vacancyCleanupService');
const ingestionPipeline     = require('./services/ingestion/IngestionPipeline');
const ingestionSources      = require('./config/ingestionSources');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// TODO: Add IP-based rate limiting middleware (e.g., express-rate-limit)
//       for abuse protection on public and sensitive endpoints.

// Routes
app.use('/api/auth', authRouter); // Public routes (google login)

// Protected Routes
app.use('/api/vacatures', vacaturesRouter); // Public for now, or check downstream? Leaving public as per current flow (search)
app.use('/api/motivation', authMiddleware, motivationRouter);
app.use('/api/profile', authMiddleware, profileRouter);
app.use('/api/search', searchRouter); // Likely public
app.use('/api/extension', extensionRouter); // Will need auth later
app.use('/api/automation', authMiddleware, automationRouter);
app.use('/api/auto-apply', authMiddleware, autoApplyRouter); // STRICTLY PROTECTED
app.use('/api/blocked-organizations', authMiddleware, blockedOrgsRouter);
app.use('/api/assets', assetsRouter); // Asset generation and management
app.use('/api/resume', resumeRouter); // Resume management (auth handled in router)
app.use('/api/admin/cleanup', cleanupRouter); // Admin cleanup routes (auth+admin handled in router)
app.use('/api/vacancies/import', importRouter);  // Extension import routes (auth+admin handled in router)
app.use('/api/ingestion', ingestionRouter);      // Legal-source ingestion API (admin only)
app.use('/api/feature-flags', authMiddleware, featureFlagsRouter); // Feature flag management
app.use('/api/applications', authMiddleware, applicationsRouter);

// Serve uploaded files (resumes, etc.)
app.use('/uploads', express.static('uploads'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: DATABASE_TYPE,
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown - close browser and database connections
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  const scraperService = require('./services/scraperService');
  await scraperService.closeBrowser();
  if (DATABASE_TYPE === 'postgres' && db.closePool) {
    await db.closePool();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...');
  const scraperService = require('./services/scraperService');
  await scraperService.closeBrowser();
  if (DATABASE_TYPE === 'postgres' && db.closePool) {
    await db.closePool();
  }
  process.exit(0);
});

// Initialize database and start server
(async () => {
  try {
    console.log(`\n🚀 Starting JobFinder Backend...`);
    console.log(`📊 Database: ${DATABASE_TYPE.toUpperCase()}\n`);

    // Test database connection
    if (DATABASE_TYPE === 'postgres') {
      await db.checkConnection();
    }

    // Initialize database schema
    await db.initializeDatabase();
    console.log('✅ Database initialized successfully\n');

    // Log ingestion source status (credentials / enabled state)
    ingestionSources.logStartupStatus();

    // Start server
    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`🌐 API endpoints: http://localhost:${PORT}/api`);
      console.log(`💚 Health check: http://localhost:${PORT}/api/health\n`);

      // Run vacancy cleanup immediately on startup (after 5s to let DB settle)
      setTimeout(async () => {
        console.log('[Cleanup] Running startup vacancy activity check...');
        try {
          const result = await vacancyCleanupService.runDailyCleanup();
          console.log(`[Cleanup] Startup check complete — checked: ${result.checked}, deactivated: ${result.deleted}, errors: ${result.errors}`);
        } catch (err) {
          console.error('[Cleanup] Startup check failed:', err.message);
        }
      }, 5000);

      // Schedule daily cleanup at 2:00 AM
      const scheduleDailyCleanup = () => {
        const now = new Date();
        const next = new Date();
        next.setHours(2, 0, 0, 0);
        if (next <= now) next.setDate(next.getDate() + 1);
        const msUntilNext = next - now;
        setTimeout(async () => {
          console.log('[Cleanup] Running scheduled daily vacancy activity check...');
          try {
            const result = await vacancyCleanupService.runDailyCleanup();
            console.log(`[Cleanup] Daily check complete — checked: ${result.checked}, deactivated: ${result.deleted}, errors: ${result.errors}`);
          } catch (err) {
            console.error('[Cleanup] Daily check failed:', err.message);
          }
          scheduleDailyCleanup(); // schedule next day
        }, msUntilNext);
        console.log(`[Cleanup] Next daily check scheduled for: ${next.toLocaleString()}`);
      };
      scheduleDailyCleanup();

      // Schedule daily ingestion at 6:00 AM (legal sources only)
      const scheduleDailyIngestion = () => {
        const now  = new Date();
        const next = new Date();
        next.setHours(6, 0, 0, 0);
        if (next <= now) next.setDate(next.getDate() + 1);
        const msUntilNext = next - now;
        setTimeout(async () => {
          console.log('[Ingestion] Running scheduled daily legal-source ingestion...');
          try {
            const telemetry = await ingestionPipeline.run();
            console.log(`[Ingestion] Daily run complete — fetched: ${telemetry.total.fetched}, inserted: ${telemetry.total.inserted}, updated: ${telemetry.total.updated}, errors: ${telemetry.total.errors}`);
          } catch (err) {
            console.error('[Ingestion] Daily run failed:', err.message);
          }
          scheduleDailyIngestion(); // schedule next day
        }, msUntilNext);
        console.log(`[Ingestion] Next daily ingestion scheduled for: ${next.toLocaleString()}`);
      };
      scheduleDailyIngestion();
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
})();

module.exports = app;
