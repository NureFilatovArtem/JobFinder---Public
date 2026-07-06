/**
 * Distance utilities for proximity-based job filtering.
 * All calculations are client-side using the Haversine formula.
 */

const EARTH_RADIUS_KM = 6371;

/**
 * Calculate the distance between two geographic points using the Haversine formula.
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lng1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lng2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
    const toRad = (deg) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_KM * c;
}

/**
 * Format a distance in km to a human-readable string.
 * @param {number} km - Distance in kilometers
 * @returns {string} Formatted string (e.g. "~3 km", "~0.5 km", "~120 km")
 */
export function formatDistance(km) {
    if (km == null || isNaN(km)) return '';
    if (km < 1) return `~${km.toFixed(1)} km`;
    if (km < 10) return `~${Math.round(km)} km`;
    return `~${Math.round(km)} km`;
}

/**
 * Extract source name from a job URL.
 * @param {string} url - Job posting URL
 * @returns {string} Human-readable source name
 */
export function getSourceName(url) {
    if (!url) return 'Job Page';
    const lower = url.toLowerCase();
    if (lower.includes('linkedin.com')) return 'LinkedIn';
    if (lower.includes('indeed.com') || lower.includes('indeed.be')) return 'Indeed';
    if (lower.includes('vdab.be')) return 'VDAB';
    if (lower.includes('stepstone')) return 'StepStone';
    if (lower.includes('glassdoor')) return 'Glassdoor';
    return 'Job Page';
}

/** Available radius options in km */
export const RADIUS_OPTIONS = [
    { value: 10, label: '10 km' },
    { value: 25, label: '25 km' },
    { value: 50, label: '50 km' },
    { value: 100, label: '100 km' },
    { value: null, label: 'All' },
];
