/**
 * GreenhouseAdapter — Greenhouse ATS public job board API.
 *
 * Docs:   https://developers.greenhouse.io/job-board.html
 * Auth:   None — all job board data is public per company token
 * Method: HTTP GET per company board endpoint
 *
 * Pagination model:
 *   Greenhouse returns ALL open jobs for a company in a single response.
 *   There is no page parameter.  This adapter therefore overrides fetchAll()
 *   to iterate over companies rather than pages.
 *
 * Company tokens:
 *   Configure GREENHOUSE_COMPANIES in .env as a comma-separated list of
 *   company board tokens (slug from https://boards.greenhouse.io/{token}).
 *   Example: GREENHOUSE_COMPANIES=booking,deliveroo,mollie,adyen
 *
 * Response shape (jobs[]):
 *   id              Numeric job ID
 *   title           Job title
 *   location.name   Location string e.g. "Ghent, Belgium"
 *   updated_at      ISO timestamp
 *   absolute_url    Full URL to the job on the company's Greenhouse board
 *   content         HTML job description
 *   departments[]   Department objects
 *   offices[]       Office objects (has location metadata)
 */

const BaseAdapter = require('../BaseAdapter');

// Country name variants AND major city names used in Greenhouse location strings.
// Greenhouse often stores just the city (e.g. "Brussel", "Amsterdam") without the country.
const COUNTRY_VARIANTS = {
  BE: [
    'belgium', 'belgique', 'belgië', 'belgie',
    'brussels', 'brussel', 'bruxelles',
    'antwerp', 'antwerpen', 'anvers',
    'ghent', 'gent', 'liège', 'liege', 'luik',
    'bruges', 'brugge', 'leuven', 'louvain',
    'namur', 'namen', 'hasselt', 'mechelen', 'kortrijk',
  ],
  NL: [
    'netherlands', 'nederland', 'pays-bas',
    'amsterdam', 'rotterdam', 'utrecht',
    'den haag', 'the hague', 'eindhoven',
    'groningen', 'tilburg', 'almere', 'breda',
    'nijmegen', 'leiden', 'arnhem', 'haarlem',
  ],
  DE: ['germany', 'deutschland', 'allemagne', 'berlin', 'munich', 'münchen', 'hamburg'],
};

class GreenhouseAdapter extends BaseAdapter {
  get name() { return 'greenhouse'; }

  /**
   * Override fetchAll — iterate over companies, not pages.
   */
  async fetchAll(keywords, country) {
    const companies = this.config.companies || [];
    const results   = [];

    this.log(`Starting — ${companies.length} companies, country: ${country}, keywords: "${keywords}"`);

    for (const companyToken of companies) {
      let attempt = 0;

      while (attempt < this.maxRetries) {
        try {
          await this._respectRateLimit();
          const { vacancies } = await this.fetchPage({ companyToken, keywords, country });
          if (vacancies.length > 0) {
            this.log(`${companyToken}: ${vacancies.length} matching jobs`);
            results.push(...vacancies);
          }
          break;
        } catch (err) {
          attempt++;
          if (attempt < this.maxRetries) {
            const wait = this._backoff(attempt);
            this.warn(`${companyToken} attempt ${attempt} failed: ${err.message} — retry in ${wait}ms`);
            await this._sleep(wait);
          } else {
            this.error(`${companyToken} failed after ${this.maxRetries} retries`, err);
          }
        }
      }
    }

    return results;
  }

  async fetchPage({ companyToken, keywords, country }) {
    const url = `${this.config.baseUrl}/${companyToken}/jobs?content=true`;
    this.log(`GET ${companyToken} board`);
    this.logRaw(`company-${companyToken}`, { url });

    const data = await this.httpGet(url);
    const jobs = (data.jobs || []).filter(j =>
      this._matchesCountry(j, country) && this._matchesKeywords(j, keywords)
    );

    const vacancies = jobs.map(j => this._map(j, companyToken, country));
    return { vacancies, hasMore: false, nextParams: null };
  }

  _matchesCountry(job, country) {
    const locationStr = (
      (job.location?.name || '') + ' ' +
      (job.offices || []).map(o => o.name || '').join(' ')
    ).toLowerCase();

    const variants = COUNTRY_VARIANTS[country] || [country.toLowerCase()];

    // Accept if location mentions the country, or if location is empty / "remote"
    return !locationStr.trim() ||
           locationStr.includes('remote') ||
           variants.some(v => locationStr.includes(v));
  }

  _matchesKeywords(job, keywords) {
    if (!keywords || !keywords.trim()) return true;
    const titleLower = (job.title || '').toLowerCase();
    // At least one keyword word must appear in the title
    return keywords.toLowerCase().split(/\s+/).some(w => w && titleLower.includes(w));
  }

  _map(j, companyToken, country) {
    const location = j.location?.name || null;

    return {
      source:          'greenhouse',
      source_id:       j.id ? String(j.id) : undefined,
      source_url:      j.absolute_url || '',
      title:           j.title        || '',
      // Greenhouse job boards don't return the company display name — use the token
      // as a placeholder; a manual mapping table can be added later if needed
      company_name:    companyToken,
      country,
      city:            this._extractCity(location),
      location_text:   location,
      description:     this._stripHtml(j.content || ''),
      posted_at:       j.updated_at ? new Date(j.updated_at) : null,
      is_remote:       (location || '').toLowerCase().includes('remote'),
      // Runtime-only
      _ingestion_method: 'api',
      _legal_confidence: 1.0,
      _raw:            JSON.stringify({ id: j.id, title: j.title, location: j.location }),
    };
  }

  _extractCity(location) {
    if (!location) return null;
    // "Ghent, Belgium" → "Ghent" | "Brussels (Remote)" → "Brussels"
    return location.split(',')[0].replace(/\s*\(.*?\)\s*$/, '').trim() || null;
  }

  _stripHtml(html) {
    if (!html) return null;
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim() || null;
  }
}

module.exports = GreenhouseAdapter;
