/**
 * Geocode existing vacancies
 * This script will geocode all vacancies that have a postcode but no accurate coordinates
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const geocodingService = require('../services/geocodingService');
const dbHelpers = require('../database/postgresHelpers_v2');
const { query } = require('../database/postgres');

async function geocodeExistingVacancies() {
    try {
        console.log('🌍 Starting geocoding of existing vacancies...\n');

        // Get all vacancies
        const vacancies = await dbHelpers.getAllVacatures({}, null);
        console.log(`Found ${vacancies.length} vacancies to process\n`);

        let geocoded = 0;
        let skipped = 0;
        let failed = 0;

        for (const vacancy of vacancies) {
            const { id, postcode, city, location } = vacancy;

            // Skip if no postcode
            if (!postcode && !location) {
                skipped++;
                console.log(`⏭️  Skipping vacancy #${id} - no location data`);
                continue;
            }

            try {
                // Geocode
                const coords = await geocodingService.geocode(
                    postcode,
                    city || location,
                    'BE'
                );

                if (coords) {
                    // Explicitly update the vacancy in the database
                    await query(
                        'UPDATE vacancies SET latitude = $1, longitude = $2 WHERE id = $3',
                        [coords.lat, coords.lng, id]
                    );

                    console.log(`✅ Vacancy #${id}: ${postcode} ${city || location} → ${coords.lat}, ${coords.lng}`);
                    geocoded++;
                } else {
                    console.log(`⚠️ Could not geocode vacancy #${id}`);
                    failed++;
                }

                // Small delay to respect rate limits
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (error) {
                failed++;
                console.error(`❌ Error geocoding vacancy #${id}:`, error.message);
            }
        }

        console.log(`\n📊 Geocoding completed:`);
        console.log(`   ✅ Geocoded: ${geocoded}`);
        console.log(`   ⏭️  Skipped: ${skipped}`);
        console.log(`   ❌ Failed: ${failed}`);
        console.log(`   📦 Total processed: ${vacancies.length}`);

    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    geocodeExistingVacancies()
        .then(() => {
            console.log('\n✅ Geocoding migration complete!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Migration failed:', error);
            process.exit(1);
        });
}

module.exports = geocodeExistingVacancies;
