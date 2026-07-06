/**
 * JoobleAdapter — Jooble job aggregator REST API.
 *
 * Docs:    https://jooble.org/api/about
 * Auth:    API key in URL path (from .env JOOBLE_API_KEY)
 * Method:  HTTP POST with JSON body, page-based pagination
 * Max results per page: 20 (Jooble hard limit)
 *
 * Request body:
 *   keywords    Search terms
 *   location    Country/city name (e.g. "Belgium", "Netherlands")
 *   page        1-indexed page number
 *   resultsOnPage  Up to 20
 *
 * Response shape:
 *   totalCount   Total results count
 *   jobs[]
 *     title      Job title
 *     company    Company name
 *     location   Location string
 *     snippet    Short description
 *     link       Jooble deeplink URL
 *     source     Original source site name
 *     type       Job type string (e.g. "Full-time", "Part-time")
 *     updated    ISO date string
 *     salary     Raw salary string (may be empty)
 */

const BaseAdapter = require('../BaseAdapter');

// Jooble uses country names (not ISO codes) in the request body
const COUNTRY_NAMES = {
  BE: 'Belgium',
  NL: 'Netherlands',
  DE: 'Germany',
  FR: 'France',
};

class JoobleAdapter extends BaseAdapter {
  get name() { return 'jooble'; }

  _initialParams(keywords, country) {
    return { keywords, country, page: 1 };
  }

  async fetchPage({ keywords, country, page }) {
    const url = `${this.config.baseUrl}/${this.config.apiKey}`;

    const body = {
      keywords,
      location:      COUNTRY_NAMES[country] || country,
      page,
      resultsOnPage: this.config.pageSize || 20,
    };

    this.log(`POST page=${page} country=${country} — "${keywords}"`);
    this.logRaw(`page-${page}`, { country, page, keywords });

    const data = await this.httpPost(url, body);
    const jobs = data.jobs || [];

    const vacancies = jobs
      .map(j => this._map(j, country))
      .filter(v => v.source_url);   // skip records with no link

    return {
      vacancies,
      hasMore:    jobs.length >= (this.config.pageSize || 20),
      nextParams: { keywords, country, page: page + 1 },
    };
  }

  _map(j, country) {
    return {
      source:          'jooble',
      source_id:       undefined,  // Jooble provides no stable native ID; URL hash used
      source_url:      j.link      || '',
      title:           j.title     || '',
      company_name:    j.company   || null,
      country,
      city:            null,       // location is a free-form string; city extracted by normalizer
      location_text:   j.location  || null,
      description:     j.snippet   || null,
      job_type:        this._mapJobType(j.type),
      salary_text:     j.salary    || null,
      posted_at:       j.updated   ? new Date(j.updated) : null,
      is_remote:       (j.type || '').toLowerCase().includes('remote'),
      // Runtime-only
      _ingestion_method: 'api',
      _legal_confidence: 0.9,  // Jooble aggregates from many sources; confidence slightly lower
      _raw:            JSON.stringify({ title: j.title, company: j.company, source: j.source }),
    };
  }

  _mapJobType(raw) {
    if (!raw) return null;
    const v = raw.toLowerCase();
    if (v.includes('full'))  return 'fulltime';
    if (v.includes('part'))  return 'parttime';
    if (v.includes('intern') || v.includes('stage')) return 'internship';
    return raw;
  }
}

module.exports = JoobleAdapter;
