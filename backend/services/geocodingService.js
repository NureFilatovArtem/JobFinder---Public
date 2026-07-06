const axios = require('axios');

// Manual mapping for common Belgian postcodes (fallback)
const manualPostcodeMapping = {
    // Antwerp postcodes
    '2000': { lat: 51.2194, lng: 4.4025, name: 'Antwerpen Centrum' },
    '2018': { lat: 51.2033, lng: 4.3986, name: 'Antwerpen' },
    '2020': { lat: 51.1894, lng: 4.4000, name: 'Antwerpen' },
    '2030': { lat: 51.2800, lng: 4.4200, name: 'Antwerpen' },
    '2040': { lat: 51.3400, lng: 4.3000, name: 'Zandvliet' },
    '2050': { lat: 51.2300, lng: 4.3800, name: 'Antwerpen' },
    '2060': { lat: 51.2300, lng: 4.4200, name: 'Antwerpen' },
    '2100': { lat: 51.2200, lng: 4.4600, name: 'Deurne' },
    '2140': { lat: 51.2200, lng: 4.4300, name: 'Borgerhout' },
    '2600': { lat: 51.2000, lng: 4.4100, name: 'Berchem' },

    // Brussels postcodes
    '1000': { lat: 50.8503, lng: 4.3517, name: 'Brussels Centre' },
    '1030': { lat: 50.8676, lng: 4.3789, name: 'Schaerbeek' },
    '1040': { lat: 50.8275, lng: 4.3789, name: 'Etterbeek' },
    '1050': { lat: 50.8265, lng: 4.3631, name: 'Ixelles' },
    '1060': { lat: 50.8337, lng: 4.3373, name: 'Saint-Gilles' },
    '1070': { lat: 50.8396, lng: 4.3142, name: 'Anderlecht' },
    '1080': { lat: 50.8549, lng: 4.3314, name: 'Molenbeek' },
    '1090': { lat: 50.8607, lng: 4.3334, name: 'Jette' },

    // Ghent postcodes
    '9000': { lat: 51.0543, lng: 3.7174, name: 'Gent Centrum' },
    '9030': { lat: 51.0919, lng: 3.7426, name: 'Mariakerke' },
    '9040': { lat: 51.0278, lng: 3.7094, name: 'Sint-Amandsberg' },
    '9050': { lat: 51.0445, lng: 3.7611, name: 'Gentbrugge' },
};

class GeocodingService {
    constructor() {
        this.cache = new Map(); // In-memory cache
        this.lastRequestTime = 0;
        this.minRequestInterval = 1100; // 1.1 seconds between requests (Nominatim limit is 1/sec)
    }

    /**
     * Main geocoding function with hybrid approach
     * @param {string} postcode - Belgian postcode
     * @param {string} city - City name
     * @param {string} country - Country code (BE, NL, etc.)
     * @returns {Promise<{lat: number, lng: number, name: string}>}
     */
    async geocode(postcode, city = '', country = 'BE') {
        try {
            // 1. Try manual mapping first (instant, reliable)
            if (postcode && manualPostcodeMapping[postcode]) {
                console.log(`✅ Geocoding: Using manual mapping for ${postcode}`);
                return manualPostcodeMapping[postcode];
            }

            // 2. Check database cache
            try {
                const dbHelpers = require('../database/postgresHelpers_v2');
                const cached = await dbHelpers.getCachedCoordinates(postcode, city, country);
                if (cached) {
                    console.log(`✅ Geocoding: Using database cache for ${postcode}, ${city}`);
                    // Also update in-memory cache
                    const cacheKey = `${postcode}_${city}_${country}`;
                    this.cache.set(cacheKey, cached);
                    return cached;
                }
            } catch (dbError) {
                console.log(`⚠️ Database cache check failed:`, dbError.message);
                // Continue to next step if database is unavailable
            }

            // 3. Check in-memory cache
            const cacheKey = `${postcode}_${city}_${country}`;
            if (this.cache.has(cacheKey)) {
                console.log(`✅ Geocoding: Using in-memory cache for ${cacheKey}`);
                return this.cache.get(cacheKey);
            }

            // 4. Try Nominatim API
            console.log(`🌐 Geocoding: Fetching from Nominatim for ${postcode}, ${city}, ${country}`);
            const coords = await this.nominatimGeocode(postcode, city, country);

            if (coords) {
                // Cache in memory
                this.cache.set(cacheKey, coords);

                // Cache in database
                try {
                    const dbHelpers = require('../database/postgresHelpers_v2');
                    await dbHelpers.cacheCoordinates(
                        postcode,
                        city,
                        country,
                        coords.lat,
                        coords.lng,
                        coords.name,
                        'nominatim'
                    );
                } catch (dbError) {
                    console.log(`⚠️ Failed to cache in database:`, dbError.message);
                }

                return coords;
            }

            // 5. Fallback to default Belgium center if everything fails
            console.log(`⚠️ Geocoding: Using default fallback for ${postcode}`);
            return { lat: 50.8503, lng: 4.3517, name: city || 'Belgium' };

        } catch (error) {
            console.error(`❌ Geocoding error for ${postcode}:`, error.message);
            // Return Belgium center as ultimate fallback
            return { lat: 50.8503, lng: 4.3517, name: city || 'Belgium' };
        }
    }

    /**
     * Geocode using Nominatim (OpenStreetMap)
     * @param {string} postcode
     * @param {string} city
     * @param {string} country
     * @returns {Promise<{lat: number, lng: number, name: string}|null>}
     */
    async nominatimGeocode(postcode, city, country) {
        try {
            // Respect rate limiting (1 request per second)
            await this.respectRateLimit();

            // Build search query
            const searchParts = [];
            if (postcode) searchParts.push(postcode);
            if (city) searchParts.push(city);
            if (country) searchParts.push(country);

            const searchQuery = searchParts.join(', ');

            // Make request to Nominatim
            const response = await axios.get('https://nominatim.openstreetmap.org/search', {
                params: {
                    q: searchQuery,
                    format: 'json',
                    limit: 1,
                    countrycodes: country.toLowerCase(),
                },
                headers: {
                    'User-Agent': 'JobFinder-App/1.0 (contact@jobfinder.app)', // Required by Nominatim
                },
                timeout: 5000, // 5 second timeout
            });

            if (response.data && response.data.length > 0) {
                const result = response.data[0];
                const coords = {
                    lat: parseFloat(result.lat),
                    lng: parseFloat(result.lon),
                    name: result.display_name || city || 'Unknown',
                };

                console.log(`✅ Nominatim success for ${searchQuery}:`, coords);
                return coords;
            }

            console.log(`⚠️ Nominatim: No results for ${searchQuery}`);
            return null;

        } catch (error) {
            console.error(`❌ Nominatim API error:`, error.message);
            return null;
        }
    }

    /**
     * Respect Nominatim rate limiting (1 request per second)
     */
    async respectRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < this.minRequestInterval) {
            const waitTime = this.minRequestInterval - timeSinceLastRequest;
            console.log(`⏳ Rate limiting: Waiting ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        this.lastRequestTime = Date.now();
    }

    /**
     * Batch geocode multiple locations
     * @param {Array<{postcode: string, city: string, country: string}>} locations
     * @returns {Promise<Array<{lat: number, lng: number, name: string}>>}
     */
    async geocodeBatch(locations) {
        const results = [];

        for (const location of locations) {
            const coords = await this.geocode(
                location.postcode,
                location.city,
                location.country || 'BE'
            );
            results.push(coords);
        }

        return results;
    }

    /**
     * Clear in-memory cache
     */
    clearCache() {
        this.cache.clear();
        console.log('🧹 Geocoding cache cleared');
    }
}

// Export singleton instance
module.exports = new GeocodingService();
