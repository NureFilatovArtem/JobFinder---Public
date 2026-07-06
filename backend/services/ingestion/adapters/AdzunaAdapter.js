/**
 * AdzunaAdapter — Adzuna job aggregator REST API.
 *
 * Docs:   https://developer.adzuna.com/
 * Auth:   app_id + app_key query params (from .env)
 * Method: HTTP GET, page-based pagination (1-indexed)
 * Countries supported: be (Belgium), nl (Netherlands), de (Germany), …
 *   NOTE: Adzuna uses LOWERCASE country codes in the URL path.
 *
 * Response shape (results[]):
 *   id                     Native job ID (string)
 *   title                  Job title
 *   company.display_name   Company name
 *   location.display_name  Full location string
 *   location.area[]        [country, region, city, ...]
 *   description            Short description snippet
 *   redirect_url           Deeplink to Adzuna job page (user-facing)
 *   salary_min / salary_max Annual salary estimates
 *   contract_type          'permanent' | 'contract' | null
 *   contract_time          'full_time' | 'part_time' | null
 *   created                ISO date string
 *   category.label         Category tag
 */

const BaseAdapter = require('../BaseAdapter');

class AdzunaAdapter extends BaseAdapter {
  get name() { return 'adzuna'; }

  _initialParams(keywords, country) {
    // Adzuna uses lowercase country code in the URL
    return { keywords, country: country.toLowerCase(), page: 1 };
  }

  async fetchPage({ keywords, country, page }) {
    const { appId, appKey, pageSize = 50 } = this.config;

    const params = new URLSearchParams({
      app_id:           appId,
      app_key:          appKey,
      results_per_page: pageSize,
      what:             keywords,
    });

    if (this.config.maxDaysOld) {
      params.set('max_days_old', this.config.maxDaysOld);
    }

    const url = `${this.config.baseUrl}/${country}/search/${page}?${params.toString()}`;
    // Log without credentials
    this.log(`GET /${country}/search/${page} — "${keywords}"`);
    this.logRaw(`page-${page}`, { country, page, keywords });

    const data = await this.httpGet(url);
    const jobs = data.results || [];

    const vacancies = jobs.map(j => this._map(j, country.toUpperCase()));

    return {
      vacancies,
      hasMore:    jobs.length === pageSize,
      nextParams: { keywords, country, page: page + 1 },
    };
  }

  _map(j, country) {
    const salaryMin = j.salary_min ? Math.round(j.salary_min) : null;
    const salaryMax = j.salary_max ? Math.round(j.salary_max) : null;

    // location.area = [country, region, city, subCity, ...]
    const area = j.location?.area || [];
    const city = area[2] || area[1] || null;  // prefer city-level (index 2)

    return {
      source:          'adzuna',
      source_id:       j.id ? String(j.id) : undefined,
      source_url:      j.redirect_url || '',
      title:           j.title        || '',
      company_name:    j.company?.display_name || null,
      country,
      city,
      location_text:   j.location?.display_name || null,
      description:     j.description  || null,
      contract_type:   this._mapContractType(j.contract_type),
      job_type:        this._mapJobType(j.contract_time),
      salary_min:      salaryMin,
      salary_max:      salaryMax,
      salary_currency: 'EUR',
      salary_period:   salaryMin || salaryMax ? 'annual' : null,
      salary_text:     this._formatSalary(salaryMin, salaryMax),
      posted_at:       j.created ? new Date(j.created) : null,
      is_remote:       (j.category?.label || '').toLowerCase().includes('remote'),
      // Runtime-only
      _ingestion_method: 'api',
      _legal_confidence: 1.0,
      _raw:            JSON.stringify({ id: j.id, title: j.title, company: j.company }),
    };
  }

  _mapContractType(raw) {
    if (!raw) return null;
    const v = raw.toLowerCase();
    if (v === 'permanent')              return 'permanent';
    if (v === 'contract' || v === 'cdd') return 'temporary';
    return raw;
  }

  _mapJobType(raw) {
    if (!raw) return null;
    const v = raw.toLowerCase();
    if (v === 'full_time'  || v === 'fulltime')  return 'fulltime';
    if (v === 'part_time'  || v === 'parttime')  return 'parttime';
    return raw;
  }

  _formatSalary(min, max) {
    if (min && max) return `€${min.toLocaleString('nl-BE')} – €${max.toLocaleString('nl-BE')}`;
    if (min)        return `€${min.toLocaleString('nl-BE')}+`;
    if (max)        return `up to €${max.toLocaleString('nl-BE')}`;
    return null;
  }
}

module.exports = AdzunaAdapter;
