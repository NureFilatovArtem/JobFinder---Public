/**
 * IngestionPipeline — orchestrator for all legal-source adapters.
 *
 * Flow:
 *   run(options)
 *     → for each enabled source
 *       → instantiate adapter
 *       → for each country × keyword
 *         → adapter.fetchAll(keyword, country) → CanonicalVacancy[]
 *         → toDbRow() each result
 *         → dbHelpers.createMultipleVacatures() (reuses ON CONFLICT dedup)
 *     → return aggregated telemetry
 *
 * Design rules:
 *  - Never touches DB schema — uses existing createVacature / createMultipleVacatures
 *  - Each source failure is isolated — one failing adapter never blocks others
 *  - Adapters are loaded lazily to avoid crashing if a module is temporarily broken
 *  - Telemetry is returned and also logged, so it can be surfaced via the API
 */

const ingestionSources = require('../../config/ingestionSources');
const { toDbRow }      = require('./canonicalVacancy');

// Lazy loader map — each entry is a function that requires the adapter on demand
const ADAPTER_LOADERS = {
  forem:      () => require('./adapters/ForemAdapter'),
  adzuna:     () => require('./adapters/AdzunaAdapter'),
  jooble:     () => require('./adapters/JoobleAdapter'),
  greenhouse: () => require('./adapters/GreenhouseAdapter'),
  lever:      () => require('./adapters/LeverAdapter'),
};

// Default search keywords for BE/NL market (used when caller doesn't specify)
const DEFAULT_KEYWORDS = [
  'student job', 'stagiair', 'jobstudent', 'stage',
  'marketing', 'sales', 'developer', 'software engineer',
  'hr', 'human resources', 'logistics', 'data analyst',
  'accountant', 'IT support', 'project manager',
];

class IngestionPipeline {
  constructor() {
    this._dbHelpers = null;
  }

  // Lazy-load to avoid circular require issues at startup
  _getDbHelpers() {
    if (!this._dbHelpers) {
      this._dbHelpers = require('../../database/postgresHelpers_v2');
    }
    return this._dbHelpers;
  }

  /**
   * Run ingestion for the specified (or all enabled) sources.
   *
   * @param {Object}   [options]
   * @param {string[]} [options.sources]   Specific source names to run; default = all enabled
   * @param {string[]} [options.countries] Country codes; default = ['BE', 'NL']
   * @param {string[]} [options.keywords]  Search keywords; default = DEFAULT_KEYWORDS
   * @returns {Promise<IngestionTelemetry>}
   */
  async run({ sources = null, countries = ['BE', 'NL'], keywords = DEFAULT_KEYWORDS } = {}) {
    const telemetry = {
      startedAt:  new Date(),
      finishedAt: null,
      durationMs: null,
      sources:    {},
      total:      { fetched: 0, inserted: 0, updated: 0, errors: 0 },
    };

    const dbHelpers    = this._getDbHelpers();
    const sourcesToRun = sources || Object.keys(ADAPTER_LOADERS);

    console.log(`[Pipeline] Starting ingestion — sources: [${sourcesToRun.join(', ')}], countries: [${countries.join(', ')}]`);

    for (const sourceName of sourcesToRun) {
      const sourceConfig = ingestionSources.sources[sourceName];

      if (!sourceConfig) {
        console.log(`[Pipeline] Unknown source: ${sourceName} — skipping`);
        continue;
      }

      if (!sourceConfig.enabled) {
        console.log(`[Pipeline] Source disabled: ${sourceName} — skipping`);
        continue;
      }

      const AdapterClass = this._loadAdapter(sourceName);
      if (!AdapterClass) continue;

      const st = { fetched: 0, inserted: 0, updated: 0, errors: 0 };
      telemetry.sources[sourceName] = st;

      // Intersect requested countries with the countries this source supports
      const activeCountries = countries.filter(c => {
        const supported = sourceConfig.countries || [];
        // Adzuna uses lowercase country codes in URL — compare case-insensitively
        return supported.some(s => s.toLowerCase() === c.toLowerCase());
      });

      if (activeCountries.length === 0) {
        console.log(`[Pipeline] ${sourceName}: no overlap with requested countries [${countries.join(', ')}] — skipping`);
        continue;
      }

      try {
        const adapter = new AdapterClass(sourceConfig);

        // Sources that ignore keywords (open data dumps) run once per country.
        // Keyword-based sources run once per country × keyword combination.
        const keywordIterations = sourceConfig.ignoreKeywords ? [''] : keywords;

        for (const country of activeCountries) {
          for (const keyword of keywordIterations) {
            try {
              const canonical = await adapter.fetchAll(keyword, country);
              st.fetched += canonical.length;

              if (canonical.length === 0) continue;

              // Log raw payloads (adapter already logs via logRaw if enabled)
              const dbRows = canonical.map(v => toDbRow(v));

              // Persist — ON CONFLICT (dedup_key) handles duplicates automatically
              const results = await dbHelpers.createMultipleVacatures(dbRows);

              for (const r of results) {
                if (r && r.was_inserted) st.inserted++;
                else if (r)              st.updated++;
              }
            } catch (err) {
              st.errors++;
              console.error(`[Pipeline] ${sourceName}/${country}/"${keyword}" failed: ${err.message}`);
            }
          }
        }
      } catch (err) {
        st.errors++;
        console.error(`[Pipeline] Fatal error initializing ${sourceName}: ${err.message}`);
      }

      // Roll up into totals
      telemetry.total.fetched   += st.fetched;
      telemetry.total.inserted  += st.inserted;
      telemetry.total.updated   += st.updated;
      telemetry.total.errors    += st.errors;

      console.log(
        `[Pipeline] ${sourceName} complete — ` +
        `fetched: ${st.fetched}, inserted: ${st.inserted}, updated: ${st.updated}, errors: ${st.errors}`
      );
    }

    telemetry.finishedAt = new Date();
    telemetry.durationMs = telemetry.finishedAt - telemetry.startedAt;

    console.log(
      `[Pipeline] All sources done in ${(telemetry.durationMs / 1000).toFixed(1)}s — ` +
      `total fetched: ${telemetry.total.fetched}, inserted: ${telemetry.total.inserted}, ` +
      `updated: ${telemetry.total.updated}, errors: ${telemetry.total.errors}`
    );

    return telemetry;
  }

  _loadAdapter(sourceName) {
    const loader = ADAPTER_LOADERS[sourceName];
    if (!loader) {
      console.warn(`[Pipeline] No adapter registered for source: ${sourceName}`);
      return null;
    }
    try {
      return loader();
    } catch (err) {
      console.error(`[Pipeline] Failed to load adapter "${sourceName}": ${err.message}`);
      return null;
    }
  }
}

// Export singleton — one pipeline instance per process
module.exports = new IngestionPipeline();
