/**
 * LeverAdapter — Lever ATS public postings API.
 *
 * Docs:   https://hire.lever.co/developer/postings
 * Auth:   None — public postings endpoint per company slug
 * Method: HTTP GET, returns all open postings in one call (no pagination)
 *
 * Pagination model:
 *   Lever returns ALL open postings for a company in a single JSON array.
 *   This adapter overrides fetchAll() to iterate over companies.
 *
 * Company slugs:
 *   Configure LEVER_COMPANIES in .env as a comma-separated list of slugs
 *   (the subdomain from https://jobs.lever.co/{slug}).
 *   Example: LEVER_COMPANIES=collibra,showpad,teamleader,bynder,sendcloud
 *
 * Response — array of posting objects:
 *   id              UUID
 *   text            Job title
 *   hostedUrl       https://jobs.lever.co/{company}/{id}  (canonical link)
 *   applyUrl        Direct application URL
 *   description     Plain-text description
 *   descriptionHtml HTML description
 *   categories
 *     location      Location string e.g. "Ghent, Belgium"
 *     department    Department name
 *     team          Team name
 *     commitment    "Full-time" | "Part-time" | "Intern" | "Contract"
 *   createdAt       Unix timestamp in milliseconds
 */

const BaseAdapter = require('../BaseAdapter');

// Country name variants AND major city names used in Lever location strings.
// Lever often stores just the city (e.g. "Amsterdam") without the country name.
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
  DE: ['germany', 'deutschland', 'berlin', 'munich', 'münchen', 'hamburg'],
};

class LeverAdapter extends BaseAdapter {
  get name() { return 'lever'; }

  /**
   * Override fetchAll — iterate over companies, not pages.
   */
  async fetchAll(keywords, country) {
    const companies = this.config.companies || [];
    const results   = [];

    this.log(`Starting — ${companies.length} companies, country: ${country}, keywords: "${keywords}"`);

    for (const companySlug of companies) {
      let attempt = 0;

      while (attempt < this.maxRetries) {
        try {
          await this._respectRateLimit();
          const { vacancies } = await this.fetchPage({ companySlug, keywords, country });
          if (vacancies.length > 0) {
            this.log(`${companySlug}: ${vacancies.length} matching jobs`);
            results.push(...vacancies);
          }
          break;
        } catch (err) {
          attempt++;
          if (attempt < this.maxRetries) {
            const wait = this._backoff(attempt);
            this.warn(`${companySlug} attempt ${attempt} failed: ${err.message} — retry in ${wait}ms`);
            await this._sleep(wait);
          } else {
            this.error(`${companySlug} failed after ${this.maxRetries} retries`, err);
          }
        }
      }
    }

    return results;
  }

  async fetchPage({ companySlug, keywords, country }) {
    const url = `${this.config.baseUrl}/${companySlug}?mode=json`;
    this.log(`GET ${companySlug}`);
    this.logRaw(`company-${companySlug}`, { url });

    const data = await this.httpGet(url);

    if (!Array.isArray(data)) {
      this.warn(`Unexpected response type from ${url} — expected array`);
      return { vacancies: [], hasMore: false, nextParams: null };
    }

    const filtered  = data.filter(j =>
      this._matchesCountry(j, country) && this._matchesKeywords(j, keywords)
    );
    const vacancies = filtered.map(j => this._map(j, companySlug, country));

    return { vacancies, hasMore: false, nextParams: null };
  }

  _matchesCountry(job, country) {
    const locationStr = (job.categories?.location || '').toLowerCase();

    // Accept if no location (company-wide remote), or location matches target country
    if (!locationStr || locationStr.includes('remote')) return true;

    const variants = COUNTRY_VARIANTS[country] || [country.toLowerCase()];
    return variants.some(v => locationStr.includes(v));
  }

  _matchesKeywords(job, keywords) {
    if (!keywords || !keywords.trim()) return true;
    const titleLower = (job.text || '').toLowerCase();
    return keywords.toLowerCase().split(/\s+/).some(w => w && titleLower.includes(w));
  }

  _map(j, companySlug, country) {
    const location = j.categories?.location || null;

    return {
      source:          'lever',
      source_id:       j.id || undefined,
      source_url:      j.hostedUrl || j.applyUrl || '',
      title:           j.text      || '',
      company_name:    companySlug,
      country,
      city:            this._extractCity(location),
      location_text:   location,
      description:     this._stripHtml(j.descriptionHtml || j.description || ''),
      contract_type:   this._mapCommitment(j.categories?.commitment),
      job_type:        this._mapJobType(j.categories?.commitment),
      posted_at:       j.createdAt ? new Date(j.createdAt) : null,  // Lever uses ms timestamp
      is_remote:       (location || '').toLowerCase().includes('remote'),
      // Runtime-only
      _ingestion_method: 'api',
      _legal_confidence: 1.0,
      _raw:            JSON.stringify({
        id:         j.id,
        text:       j.text,
        categories: j.categories,
      }),
    };
  }

  _extractCity(location) {
    if (!location) return null;
    return location.split(',')[0].replace(/\s*\(.*?\)\s*$/, '').trim() || null;
  }

  _mapCommitment(commitment) {
    if (!commitment) return null;
    const v = commitment.toLowerCase();
    if (v.includes('full'))     return 'permanent';
    if (v.includes('part'))     return 'temporary';
    if (v.includes('intern'))   return 'internship';
    if (v.includes('contract')) return 'temporary';
    return commitment;
  }

  _mapJobType(commitment) {
    if (!commitment) return null;
    const v = commitment.toLowerCase();
    if (v.includes('full'))  return 'fulltime';
    if (v.includes('part'))  return 'parttime';
    return null;
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

module.exports = LeverAdapter;
