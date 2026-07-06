/**
 * Vacancy Normalizer
 * 
 * Single source of truth for all text canonicalization used in deduplication.
 * Used consistently by: scrapers, DB helpers, backfill/cleanup scripts.
 * 
 * Enterprise-grade: handles accents, whitespace, URL tracking params,
 * city extraction from Belgian location strings, and deterministic hashing.
 */

const crypto = require('crypto');

// ============================================
// TEXT NORMALIZATION
// ============================================

/**
 * Normalize a text field for deduplication.
 * - lowercase
 * - trim
 * - collapse repeated whitespace
 * - strip diacritics/accents
 * - remove leading/trailing punctuation noise
 * 
 * @param {string} value - Raw text value
 * @returns {string} Normalized canonical value
 */
function normalizeDedupField(value) {
    if (!value || typeof value !== 'string') return '';

    return stripAccents(
        value
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ')          // collapse whitespace
            .replace(/^[^\w\s]+/, '')       // strip leading punctuation
            .replace(/[^\w\s]+$/, '')       // strip trailing punctuation
            .trim()
    );
}

/**
 * Strip diacritics / accents from a string.
 * "réceptionniste" → "receptionniste"
 * "Liège" → "liege"
 * 
 * Uses Unicode NFD decomposition + combining marks removal.
 * 
 * @param {string} str
 * @returns {string}
 */
function stripAccents(str) {
    if (!str) return '';
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ============================================
// URL NORMALIZATION
// ============================================

// Tracking parameters to strip from URLs before hashing
const TRACKING_PARAMS = new Set([
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'fbclid', 'gclid', 'msclkid', 'dclid',
    'ref', 'referer', 'referrer',
    'track', 'tracking', 'trk', 'trkInfo',
    'mc_cid', 'mc_eid',
    '_ga', '_gl', '_hsenc', '_hsmi',
    'hsa_acc', 'hsa_cam', 'hsa_grp', 'hsa_ad', 'hsa_src', 'hsa_tgt',
    'hsa_kw', 'hsa_mt', 'hsa_net', 'hsa_ver',
    'si', 'igshid',
    'source', // common but ambiguous — strip only from URL params
    'fromSearchOverlay', 'position', 'pageNum', 'clickSource',
]);

/**
 * Normalize a URL for deduplication.
 * - Strip tracking parameters (utm_*, fbclid, gclid, etc.)
 * - Normalize protocol to https
 * - Remove trailing slash
 * - Remove fragment/hash
 * - Sort remaining query params for consistency
 * 
 * @param {string} url - Raw URL
 * @returns {string} Cleaned canonical URL
 */
function normalizeUrl(url) {
    if (!url || typeof url !== 'string') return '';

    try {
        const parsed = new URL(url.trim());

        // Normalize protocol
        parsed.protocol = 'https:';

        // Remove hash/fragment
        parsed.hash = '';

        // Filter out tracking params and sort remaining
        const cleanParams = new URLSearchParams();
        const entries = [...parsed.searchParams.entries()]
            .filter(([key]) => !TRACKING_PARAMS.has(key.toLowerCase()))
            .sort(([a], [b]) => a.localeCompare(b));

        for (const [key, value] of entries) {
            cleanParams.set(key, value);
        }

        parsed.search = cleanParams.toString() ? `?${cleanParams.toString()}` : '';

        // Remove trailing slash from pathname (but keep root "/")
        if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
            parsed.pathname = parsed.pathname.slice(0, -1);
        }

        return parsed.toString();
    } catch (e) {
        // If URL parsing fails, return trimmed lowercase version
        return url.trim().toLowerCase();
    }
}

// ============================================
// CITY / LOCATION NORMALIZATION
// ============================================

/**
 * Extract and normalize the city from a raw location_text string.
 * 
 * Handles Belgian location formats:
 *   "Antwerpen"                            → "antwerpen"
 *   "2018 Antwerpen"                       → "antwerpen"
 *   "Antwerpen, Vlaanderen, België"        → "antwerpen"
 *   "Berchem, Vlaanderen, België"          → "berchem"
 *   "Brussel, Brussels Hoofdstedelijk..."  → "brussel"
 *   "8000 Brugge"                          → "brugge"
 *   "Brussel en omgeving"                  → "brussel"
 *   "België"                               → "belgie"
 * 
 * Design decision: we keep sub-city granularity (Berchem ≠ Antwerpen).
 * A job in Berchem is genuinely at a different location than Antwerpen centrum.
 * This prevents over-aggressive dedup across districts.
 * 
 * @param {string} locationText - Raw location string from scraper
 * @returns {string} Normalized city name (lowercase, no accents)
 */
function normalizeCity(locationText) {
    if (!locationText || typeof locationText !== 'string') return '';

    let city = locationText.trim();

    // Step 1: Strip leading postcode (Belgian postcodes are 4 digits)
    city = city.replace(/^\d{4}\s+/, '');

    // Step 2: Take the first comma-separated segment (usually the city)
    city = city.split(',')[0].trim();

    // Step 3: Strip common suffixes that add noise
    city = city
        .replace(/\s+en\s+omgeving$/i, '')      // "Brussel en omgeving" → "Brussel"
        .replace(/\s+\(.*?\)$/i, '')              // "Antwerpen (Linkeroever)" → "Antwerpen"
        .replace(/\s+regio$/i, '')                // "Gent regio" → "Gent"
        .replace(/\s+centrum$/i, '')              // "Antwerpen centrum" → "Antwerpen"
        .trim();

    // Step 4: Normalize text (lowercase, strip accents, collapse spaces)
    return normalizeDedupField(city);
}

// ============================================
// DEDUP KEY GENERATION
// ============================================

/**
 * Build the raw (unhashed) dedup key string from a vacancy object.
 * Format: "source|title_normalized|company_normalized|city_normalized"
 * 
 * This string is inspectable for debugging. The hash of this string
 * becomes the stored `dedup_key` column.
 * 
 * @param {Object} job - Vacancy object with at minimum: source, title
 * @param {string} job.source - Source site identifier
 * @param {string} job.title - Raw job title
 * @param {string} [job.company] - Raw company name
 * @param {string} [job.company_name] - Alternative company field
 * @param {string} [job.location] - Raw location text
 * @param {string} [job.location_text] - Alternative location field
 * @returns {string} Pipe-delimited normalized dedup key string
 */
function buildVacancyDedupKey(job) {
    const source = (job.source || 'unknown').toLowerCase().trim();
    const title = normalizeDedupField(job.title);
    const company = normalizeDedupField(job.company || job.company_name || '');
    const city = normalizeCity(job.location || job.location_text || '');

    return `${source}|${title}|${company}|${city}`;
}

/**
 * Generate the MD5 hash of the dedup key.
 * This is stored in the `dedup_key` column and has a unique index.
 * 
 * @param {Object} job - Vacancy object
 * @returns {string} 32-character hex MD5 hash
 */
function generateDedupKeyHash(job) {
    const raw = buildVacancyDedupKey(job);
    return crypto.createHash('md5').update(raw).digest('hex');
}

// ============================================
// SOURCE ID GENERATION (Identity Priority Chain)
// ============================================

/**
 * Generate a deterministic source_id using the identity priority chain:
 * 
 *   1. Source-native ID (e.g., LinkedIn job ID "4182736592")
 *   2. Canonical URL hash (MD5 of cleaned source_url)
 *   3. Business dedup hash (MD5 of source|title|company|city)
 * 
 * This ensures the same vacancy always gets the same source_id,
 * regardless of when it was scraped.
 * 
 * @param {Object} job - Vacancy object
 * @param {string} [job.source_id] - Existing source-native ID (if any)
 * @param {string} [job.linkedin_job_id] - LinkedIn-specific native ID
 * @param {string} [job.source_url] - Source URL
 * @param {string} [job.link] - Alternative URL field
 * @returns {string} Deterministic source_id
 */
function generateSourceId(job) {
    // Priority 1: Source-native ID
    if (job.source_id && !job.source_id.includes('_') && job.source_id.length < 50) {
        // Looks like a real native ID (not our old generated ones with underscores)
        return job.source_id;
    }
    if (job.linkedin_job_id) {
        return `li_${job.linkedin_job_id}`;
    }

    // Priority 2: Canonical URL hash
    const url = job.source_url || job.link || '';
    if (url && url.length > 10) {
        const cleanedUrl = normalizeUrl(url);
        return 'url_' + crypto.createHash('md5').update(cleanedUrl).digest('hex').substring(0, 16);
    }

    // Priority 3: Business dedup hash (fallback)
    const dedupKey = buildVacancyDedupKey(job);
    return 'biz_' + crypto.createHash('md5').update(dedupKey).digest('hex').substring(0, 16);
}

// ============================================
// EDGE CASE: DEDUP SAFETY FOR INCOMPLETE DATA
// ============================================

/**
 * Determine if a vacancy has enough data for reliable business-level dedup.
 * 
 * When both company AND location are missing, the dedup key becomes
 * just "source|title||" which is too aggressive — it would collapse
 * all "Magazijnier" jobs from indeed into one, regardless of actual company/city.
 * 
 * In such cases, callers should prefer URL-based dedup only.
 * 
 * @param {Object} job - Vacancy object
 * @returns {boolean} True if business-level dedup is safe
 */
function hasEnoughDataForBusinessDedup(job) {
    const company = normalizeDedupField(job.company || job.company_name || '');
    const city = normalizeCity(job.location || job.location_text || '');

    // Need at least one of company or city to safely dedup by business rule
    return company.length > 0 || city.length > 0;
}

/**
 * Generate the final dedup_key hash with edge case handling.
 * 
 * If the vacancy has insufficient data for business dedup (no company AND no city),
 * fall back to URL-based dedup key to avoid false merges.
 * 
 * @param {Object} job - Vacancy object
 * @returns {string} 32-character hex MD5 hash
 */
function generateSafeDedupKey(job) {
    if (hasEnoughDataForBusinessDedup(job)) {
        return generateDedupKeyHash(job);
    }

    // Fallback: use URL-based key for incomplete data
    const url = job.source_url || job.link || '';
    if (url && url.length > 10) {
        const cleanedUrl = normalizeUrl(url);
        return crypto.createHash('md5').update(`url|${cleanedUrl}`).digest('hex');
    }

    // Last resort: still use business key but with a warning
    // This is the "generic title with no context" case
    return generateDedupKeyHash(job);
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    // Text normalization
    normalizeDedupField,
    stripAccents,

    // URL normalization  
    normalizeUrl,

    // Location normalization
    normalizeCity,

    // Dedup key generation
    buildVacancyDedupKey,
    generateDedupKeyHash,
    generateSafeDedupKey,

    // Source ID generation
    generateSourceId,

    // Edge case checks
    hasEnoughDataForBusinessDedup,
};
