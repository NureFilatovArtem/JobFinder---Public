/**
 * Canonical in-code vacancy model.
 *
 * Every source adapter produces a CanonicalVacancy.  The `toDbRow()` function
 * maps it onto the existing `vacancies` table without any schema changes.
 *
 * Runtime-only fields (prefixed with `_`) are used for structured logging and
 * raw payload debugging.  They are NEVER written to the database.
 *
 * Field mapping recap (adapters fill these):
 * ─────────────────────────────────────────────────────────────────────────────
 *  source          → vacancies.source          e.g. 'adzuna', 'forem', 'lever'
 *  source_id       → vacancies.source_id       native job ID or generated hash
 *  source_url      → vacancies.source_url      deeplink / apply URL shown to user
 *  title           → vacancies.title
 *  company_name    → vacancies.company_name    triggers findOrCreateCompany()
 *  country         → vacancies.country_id      ISO-2: 'BE', 'NL'
 *  city            → vacancies.city_id         triggers findOrCreateCity()
 *  location_text   → vacancies.location_text   raw string e.g. "Ghent, Belgium"
 *  description     → vacancies.description
 *  requirements    → vacancies.requirements
 *  responsibilities→ vacancies.responsibilities
 *  benefits        → vacancies.benefits
 *  contract_type   → vacancies.contract_type   'permanent'|'temporary'|'internship'
 *  job_type        → vacancies.job_type        'fulltime'|'parttime'
 *  experience_level→ vacancies.experience_level
 *  employment_type → vacancies.employment_type
 *  salary_min/max  → vacancies.salary_min/max
 *  salary_currency → vacancies.salary_currency default 'EUR'
 *  salary_period   → vacancies.salary_period   'monthly'|'annual'|'hourly'
 *  salary_text     → vacancies.salary_text     raw string e.g. "€2500–3500/month"
 *  required_skills → vacancies.required_skills
 *  preferred_skills→ vacancies.preferred_skills
 *  languages_required→vacancies.languages_required
 *  posted_at       → vacancies.posted_at
 *  expires_at      → vacancies.expires_at
 *  is_remote       → vacancies.is_remote
 *
 * Runtime-only (logged, NOT persisted):
 *  _ingestion_method  'api' | 'open_data' | 'xml_feed'
 *  _legal_confidence  0–1 confidence score that this is a TOS-safe source
 *  _raw               raw JSON payload from the source API (for debug logging)
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Convert a CanonicalVacancy to a DB-ready row.
 *
 * Strips all `_`-prefixed runtime fields and supplies all the field aliases
 * that postgresHelpers_v2.mapLegacyVacancyFields() accepts, so the existing
 * persistence layer works without any modification.
 *
 * @param {Object} v  CanonicalVacancy
 * @returns {Object}  Row object accepted by createVacature() / createMultipleVacatures()
 */
function toDbRow(v) {
  return {
    // ── Identity ──────────────────────────────────────────────────────────────
    source:             v.source,
    source_id:          v.source_id   || undefined,  // generateSourceId() fills if absent
    source_url:         v.source_url,
    link:               v.source_url,                // legacy alias for mapLegacyVacancyFields
    url:                v.source_url,                // extra alias, just in case

    // ── Job details ───────────────────────────────────────────────────────────
    title:              v.title,
    company_name:       v.company_name        || null,
    company:            v.company_name        || null,  // legacy alias

    // ── Location ──────────────────────────────────────────────────────────────
    country:            v.country             || null,  // findOrCreateCountry() resolves this
    city:               v.city                || null,  // findOrCreateCity() resolves this
    location:           v.location_text || v.city || null,  // legacy alias
    location_text:      v.location_text       || null,

    // ── Content ───────────────────────────────────────────────────────────────
    description:        v.description         || null,
    requirements:       v.requirements        || null,
    responsibilities:   v.responsibilities    || null,
    benefits:           v.benefits            || null,

    // ── Classification ────────────────────────────────────────────────────────
    contract_type:      v.contract_type       || null,
    job_type:           v.job_type            || null,
    experience_level:   v.experience_level    || null,
    employment_type:    v.employment_type     || null,

    // ── Salary ────────────────────────────────────────────────────────────────
    salary_min:         v.salary_min          || null,
    salary_max:         v.salary_max          || null,
    salary_currency:    v.salary_currency     || 'EUR',
    salary_period:      v.salary_period       || null,
    salary_text:        v.salary_text         || null,

    // ── Skills / languages ────────────────────────────────────────────────────
    required_skills:    v.required_skills     || null,
    preferred_skills:   v.preferred_skills    || null,
    languages_required: v.languages_required  || null,

    // ── Dates ─────────────────────────────────────────────────────────────────
    posted_at:          v.posted_at           || null,
    expires_at:         v.expires_at          || null,

    // ── Flags ─────────────────────────────────────────────────────────────────
    is_remote:          v.is_remote           || false,

    // Runtime fields are intentionally excluded — they are never persisted.
    // _ingestion_method, _legal_confidence, _raw are consumed only by loggers.
  };
}

module.exports = { toDbRow };
