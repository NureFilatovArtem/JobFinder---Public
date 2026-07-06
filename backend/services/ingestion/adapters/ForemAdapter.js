/**
 * ForemAdapter — Forem Open Data (Walloon public employment service, Belgium).
 *
 * Source:  https://opendata.forem.be
 * API:     OpenDataSoft REST API v2.1
 * Auth:    None — fully public open data
 * Method:  HTTP GET with offset-based pagination
 * Country: Belgium only (Wallonia / French-speaking)
 *
 * Field reference (Forem dataset "offres-demploi-forem"):
 *   id_offre           Unique offer ID
 *   reference_forem    Secondary reference
 *   intitule_du_poste  Job title
 *   nom_employeur      Employer name
 *   localite           City / municipality
 *   description_du_poste  Full job description
 *   type_contrat       Contract type (CDI, CDD, Intérim…)
 *   regime_travail     Work regime (Temps plein, Temps partiel…)
 *   date_publication   ISO date of publication
 *   date_echeance      Expiry date
 *   url_offre          Direct link to the offer on forem.be
 */

const BaseAdapter = require('../BaseAdapter');

class ForemAdapter extends BaseAdapter {
  get name() { return 'forem'; }

  _initialParams(keywords, country) {
    return { keywords, country, offset: 0 };
  }

  async fetchPage({ keywords, country, offset }) {
    const pageSize = this.config.pageSize || 100;

    // Forem is a French-language platform — keyword matching is unreliable across
    // languages, so we fetch all records and let the DB dedup layer handle duplicates.
    // The dataset is public open data; volume is manageable (~few thousand total).
    const params = new URLSearchParams({
      limit:    pageSize,
      offset,
      order_by: 'date_publication DESC',
    });

    const url = `${this.config.baseUrl}?${params.toString()}`;
    this.log(`GET offset=${offset} — ${keywords}`);
    this.logRaw(`offset-${offset}`, { url });

    const data    = await this.httpGet(url);
    const records = data.results || [];
    const vacancies = records
      .map(r => this._map(r, country))
      .filter(v => v.source_url); // skip records with no apply URL

    return {
      vacancies,
      hasMore:    records.length === pageSize,
      nextParams: { keywords, country, offset: offset + pageSize },
    };
  }

  _map(r, country) {
    return {
      source:          'forem',
      source_id:       r.id_offre || r.reference_forem || undefined,
      source_url:      r.url_offre || r.lien_candidature || '',
      title:           r.intitule_du_poste || r.fonction || '',
      company_name:    r.nom_employeur || r.societe || null,
      country:         'BE',
      city:            r.localite || r.commune || null,
      location_text:   r.localite
        ? `${r.localite}, Wallonie, Belgique`
        : (r.commune || null),
      description:     r.description_du_poste || r.texte_offre || null,
      contract_type:   this._mapContractType(r.type_contrat),
      job_type:        this._mapJobType(r.regime_travail),
      posted_at:       r.date_publication ? new Date(r.date_publication) : null,
      expires_at:      r.date_echeance    ? new Date(r.date_echeance)    : null,
      is_remote:       false,
      // Runtime-only
      _ingestion_method: 'open_data',
      _legal_confidence: 1.0,
      _raw:            JSON.stringify(r),
    };
  }

  _mapContractType(raw) {
    if (!raw) return null;
    const v = raw.toLowerCase();
    if (v.includes('indeterminee') || v.includes('cdi') || v.includes('onbepaald')) return 'permanent';
    if (v.includes('determinee')   || v.includes('cdd') || v.includes('bepaald'))   return 'temporary';
    if (v.includes('stage')        || v.includes('interimaire'))                     return 'internship';
    if (v.includes('interim'))                                                        return 'temporary';
    return raw;
  }

  _mapJobType(raw) {
    if (!raw) return null;
    const v = raw.toLowerCase();
    if (v.includes('temps plein') || v.includes('voltijds') || v.includes('full')) return 'fulltime';
    if (v.includes('temps partiel')|| v.includes('deeltijds')|| v.includes('part')) return 'parttime';
    return raw;
  }
}

module.exports = ForemAdapter;
