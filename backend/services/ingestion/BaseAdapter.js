/**
 * BaseAdapter — abstract base class for all legal-source ingestion adapters.
 *
 * Responsibilities:
 *  ✓ Enforce a common interface:  fetchAll() → CanonicalVacancy[]
 *  ✓ Per-request rate limiting (configurable delay between HTTP calls)
 *  ✓ Exponential back-off retry with configurable max attempts
 *  ✓ HTTP GET and POST helpers using Node's built-in https/http modules
 *    (no extra npm dependency required)
 *  ✓ Structured logging scoped to source name
 *  ✓ Raw payload capture for debug logging (opt-in via INGESTION_LOG_RAW=true)
 *
 * Subclasses MUST override:
 *  get name()           → string          e.g. 'adzuna'
 *  fetchPage(params)    → { vacancies, hasMore, nextParams }
 *
 * Subclasses MAY override:
 *  _initialParams(keywords, country)  → first-page params object
 *
 * Pagination contract
 * ───────────────────
 * fetchAll() calls fetchPage() in a loop, passing the params returned as
 * `nextParams` from the previous call.  Pagination stops when:
 *   - hasMore === false  (source says no more pages), OR
 *   - nextParams === null / undefined, OR
 *   - page count exceeds config.maxPages
 * Adapters that work per-company (Greenhouse, Lever) can override fetchAll()
 * entirely to iterate over companies instead of pages.
 */

const https = require('https');
const http  = require('http');

class BaseAdapter {
  /**
   * @param {Object} config  Source config entry from ingestionSources.js
   */
  constructor(config) {
    this.config       = config;
    this.rateLimitMs  = config.rateLimit || 500;
    this.maxRetries   = config.retries   || 3;
    this._lastRequestAt = 0;
  }

  // ─── Interface — subclasses must implement ──────────────────────────────────

  get name() {
    throw new Error(`${this.constructor.name} must implement get name()`);
  }

  /**
   * Fetch one page of results from the source.
   *
   * @param  {Object} params          Adapter-specific page/offset/cursor
   * @returns {Promise<{
   *   vacancies:  CanonicalVacancy[],
   *   hasMore:    boolean,
   *   nextParams: Object|null
   * }>}
   */
  // eslint-disable-next-line no-unused-vars
  async fetchPage(params) {
    throw new Error(`${this.constructor.name} must implement fetchPage(params)`);
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Fetch ALL vacancies for a given keyword + country combination.
   * Handles pagination, rate limiting and retries automatically.
   *
   * @param  {string} keywords   e.g. 'developer'
   * @param  {string} country    ISO-2 country code e.g. 'BE', 'NL'
   * @returns {Promise<CanonicalVacancy[]>}
   */
  async fetchAll(keywords, country) {
    const results  = [];
    let   params   = this._initialParams(keywords, country);
    let   page     = 1;
    const maxPages = this.config.maxPages || 10;

    this.log(`Starting — keywords: "${keywords}", country: ${country}`);

    while (page <= maxPages) {
      let attempt   = 0;
      let lastError = null;
      let succeeded = false;

      while (attempt < this.maxRetries) {
        try {
          await this._respectRateLimit();
          const { vacancies, hasMore, nextParams } = await this.fetchPage(params);

          this.log(`Page ${page}: ${vacancies.length} vacancies`);
          results.push(...vacancies);

          if (!hasMore || !nextParams) {
            return results;   // natural end of pagination
          }

          params    = nextParams;
          page++;
          succeeded = true;
          break;
        } catch (err) {
          attempt++;
          lastError = err;
          if (attempt < this.maxRetries) {
            const wait = this._backoff(attempt);
            this.warn(`Page ${page} attempt ${attempt} failed: ${err.message} — retry in ${wait}ms`);
            await this._sleep(wait);
          }
        }
      }

      if (!succeeded) {
        this.error(`Page ${page} failed after ${this.maxRetries} retries — stopping`, lastError);
        break;
      }
    }

    return results;
  }

  // ─── HTTP helpers ───────────────────────────────────────────────────────────

  /**
   * HTTP GET — returns parsed JSON.
   * Uses Node's built-in https/http; no axios or node-fetch needed.
   *
   * @param  {string} url
   * @param  {Object} [extraHeaders]
   * @returns {Promise<any>}
   */
  httpGet(url, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
      const lib  = url.startsWith('https') ? https : http;
      const opts = {
        headers: {
          Accept:       'application/json',
          'User-Agent': 'JobFinder-Ingestion/1.0',
          ...extraHeaders,
        },
        timeout: 15000,
      };

      const req = lib.get(url, opts, (res) => {
        if (res.statusCode === 429) {
          return reject(new Error(`Rate-limited (429): ${url}`));
        }
        if (res.statusCode >= 400) {
          return reject(new Error(`HTTP ${res.statusCode}: ${url}`));
        }

        let raw = '';
        res.on('data', chunk => (raw += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch {
            reject(new Error(`JSON parse error from ${url}: ${raw.substring(0, 200)}`));
          }
        });
      });

      req.on('error',   reject);
      req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
    });
  }

  /**
   * HTTP POST — sends JSON body, returns parsed JSON.
   *
   * @param  {string} url
   * @param  {Object} body
   * @param  {Object} [extraHeaders]
   * @returns {Promise<any>}
   */
  httpPost(url, body, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
      const lib     = url.startsWith('https') ? https : http;
      const bodyStr = JSON.stringify(body);
      const parsed  = new URL(url);

      const opts = {
        hostname: parsed.hostname,
        port:     parsed.port || (url.startsWith('https') ? 443 : 80),
        path:     parsed.pathname + parsed.search,
        method:   'POST',
        headers:  {
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
          Accept:           'application/json',
          'User-Agent':     'JobFinder-Ingestion/1.0',
          ...extraHeaders,
        },
        timeout: 15000,
      };

      const req = lib.request(opts, (res) => {
        if (res.statusCode === 429) {
          return reject(new Error(`Rate-limited (429): ${url}`));
        }
        if (res.statusCode >= 400) {
          return reject(new Error(`HTTP ${res.statusCode}: ${url}`));
        }

        let raw = '';
        res.on('data', chunk => (raw += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch {
            reject(new Error(`JSON parse error from POST ${url}`));
          }
        });
      });

      req.on('error',   reject);
      req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
      req.write(bodyStr);
      req.end();
    });
  }

  // ─── Logging helpers ────────────────────────────────────────────────────────

  log(msg)       { console.log (`[${this.name}] ${msg}`); }
  warn(msg)      { console.warn(`[${this.name}] WARN: ${msg}`); }
  error(msg, err) {
    console.error(`[${this.name}] ERROR: ${msg}`, err ? (err.stack || err.message) : '');
  }

  /**
   * Log the raw API payload for debugging.
   * Only active when INGESTION_LOG_RAW=true — keeps production logs clean.
   *
   * @param {string} label     e.g. 'page-1', 'company-booking'
   * @param {any}    payload   Raw response or excerpt
   */
  logRaw(label, payload) {
    if (process.env.INGESTION_LOG_RAW === 'true') {
      const excerpt = typeof payload === 'string'
        ? payload.substring(0, 500)
        : JSON.stringify(payload).substring(0, 500);
      console.log(`[RAW:${this.name}:${label}] ${excerpt}`);
    }
  }

  // ─── Protected helpers (available to subclasses) ────────────────────────────

  /**
   * Build the initial page params for fetchAll().
   * Override in subclasses that use different param shapes.
   *
   * @param  {string} keywords
   * @param  {string} country
   * @returns {Object}
   */
  _initialParams(keywords, country) {
    return { keywords, country, page: 1, offset: 0 };
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  async _respectRateLimit() {
    const elapsed = Date.now() - this._lastRequestAt;
    if (elapsed < this.rateLimitMs) {
      await this._sleep(this.rateLimitMs - elapsed);
    }
    this._lastRequestAt = Date.now();
  }

  /** Exponential back-off: 1s → 2s → 4s, capped at 30s */
  _backoff(attempt) {
    return Math.min(1000 * Math.pow(2, attempt - 1), 30000);
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = BaseAdapter;
