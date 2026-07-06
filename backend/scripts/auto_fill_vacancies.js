/**
 * Auto-Fill Vacancy Map Script
 * 
 * Automatically searches for vacancies across all Belgian regions (except Antwerp)
 * focusing on jobs interesting for:
 *   - Students & women (18-50): cleaning, retail, healthcare, childcare, admin, hospitality
 *   - Men (18+): construction, logistics, warehouse, driving, technical
 *
 * Usage: node scripts/auto_fill_vacancies.js
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

// =========================================================
// REGIONS: All Belgian provinces excluding Antwerp
// Use major city per province/region as representative search
// =========================================================
const REGIONS_BY_PROVINCE = {
    'Brussel': ['Brussel'],
    'Oost-Vlaanderen': ['Gent', 'Aalst', 'Sint-Niklaas', 'Dendermonde'],
    'West-Vlaanderen': ['Brugge', 'Kortrijk', 'Oostende', 'Roeselare'],
    'Vlaams-Brabant': ['Leuven', 'Vilvoorde', 'Halle'],
    'Limburg': ['Hasselt', 'Genk', 'Sint-Truiden'],
    'Henegouwen': ['Charleroi', 'Bergen', 'La Louvière', 'Doornik'],
    'Luik': ['Luik', 'Seraing', 'Verviers'],
    'Namen': ['Namen', 'Andenne'],
    'Waals-Brabant': ['Waver', 'Nijvel'],
    'Luxemburg': ['Aarlen', 'Bastenaken'],
};

// All cities combined (excluding Antwerp province)
const ALL_CITIES = Object.values(REGIONS_BY_PROVINCE).flat();

// =========================================================
// JOB CATEGORIES
// =========================================================
const JOB_SEARCHES = [
    // --- For women & students ---
    { keywords: 'schoonmaak', label: 'Schoonmaak (NL)' },
    { keywords: 'nettoyage', label: 'Nettoyage (FR)' },
    { keywords: 'nettoyage bâtiment', label: 'Nettoyage bâtiment (FR)' },
    { keywords: 'schoonmaakster', label: 'Schoonmaakster (NL)' },
    { keywords: 'huishoudelijke hulp', label: 'Huishoudelijke hulp (NL)' },
    { keywords: 'aide ménagère', label: 'Aide ménagère (FR)' },
    { keywords: 'winkelbediende', label: 'Winkelbediende / Retail (NL)' },
    { keywords: 'vendeur caissier', label: 'Vendeur / Caissier (FR)' },
    { keywords: 'caissière supermarché', label: 'Caissière (FR)' },
    { keywords: 'kassamedewerker', label: 'Kassamedewerker (NL)' },
    { keywords: 'verzorgende thuiszorg', label: 'Thuiszorg / Verzorging (NL)' },
    { keywords: 'aide soignante', label: 'Aide soignante (FR)' },
    { keywords: 'kinderbegeleider', label: 'Kinderbegeleider (NL)' },
    { keywords: 'garde enfants', label: 'Garde enfants (FR)' },
    { keywords: 'onthaalmedewerker', label: 'Onthaal / Receptie (NL)' },
    { keywords: 'hôtesse accueil', label: 'Hôtesse accueil (FR)' },
    { keywords: 'administratief medewerker', label: 'Administratief medewerker (NL)' },
    { keywords: 'secrétaire assistant', label: 'Secrétaire / Assistant (FR)' },
    { keywords: 'horeca medewerker', label: 'Horeca / Bediening (NL)' },
    { keywords: 'serveur restauration', label: 'Serveur / Restauration (FR)' },
    { keywords: 'jobstudent zomer', label: 'Jobstudent (NL)' },
    { keywords: 'job étudiant', label: 'Job étudiant (FR)' },
    { keywords: 'polyvalent magasin', label: 'Polyvalent magasin (FR)' },

    // --- For men (18+) ---
    { keywords: 'bouwvakker', label: 'Bouwvakker / Constructie (NL)' },
    { keywords: 'ouvrier construction', label: 'Ouvrier construction (FR)' },
    { keywords: 'elektricien', label: 'Elektricien (NL)' },
    { keywords: 'électricien', label: 'Électricien (FR)' },
    { keywords: 'loodgieter', label: 'Loodgieter (NL)' },
    { keywords: 'plombier', label: 'Plombier (FR)' },
    { keywords: 'chauffeur vrachtwagen', label: 'Vrachtwagenchauffeur (NL)' },
    { keywords: 'chauffeur poids lourd', label: 'Chauffeur PL (FR)' },
    { keywords: 'magazijnier logistiek', label: 'Magazijnier / Logistiek (NL)' },
    { keywords: 'magasinier logistique', label: 'Magasinier logistique (FR)' },
    { keywords: "mecanicien auto", label: "Mécanicien auto (FR)" },
    { keywords: 'automonteur', label: 'Automonteur / Garage (NL)' },
    { keywords: 'lasser metaal', label: 'Lasser / Metaalbewerker (NL)' },
    { keywords: 'soudeur métallurgie', label: 'Soudeur (FR)' },
    { keywords: 'tuinier groenonderhoud', label: 'Tuinier / Groenonderhoud (NL)' },
    { keywords: 'jardinier entretien', label: 'Jardinier (FR)' },
    { keywords: 'productiemedewerker', label: 'Productiemedewerker (NL)' },
    { keywords: 'opérateur production', label: 'Opérateur production (FR)' },
    { keywords: 'beveiligingsagent', label: 'Bewaker / Beveiliging (NL)' },
    { keywords: 'agent sécurité', label: 'Agent de sécurité (FR)' },
    { keywords: 'dakwerker roofer', label: 'Dakwerker (NL)' },
    { keywords: 'couvreur toiture', label: 'Couvreur (FR)' },
];

// =========================================================
// HELPER: Send POST request to the backend
// =========================================================
function postRequest(path, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const options = {
            hostname: 'localhost',
            port: 3000,
            path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
            },
        };

        const req = http.request(options, (res) => {
            let raw = '';
            res.on('data', (chunk) => { raw += chunk; });
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(raw) });
                } catch {
                    resolve({ status: res.statusCode, body: raw });
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(360000, () => {
            req.destroy(new Error('Request timeout after 360s'));
        });
        req.write(data);
        req.end();
    });
}

// =========================================================
// HELPER: Sleep
// =========================================================
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// =========================================================
// MAIN: Run all searches
// =========================================================
async function main() {
    console.log('\n🚀 Starting Automatic Vacancy Fill for Belgium (excl. Antwerp)');
    console.log('='.repeat(65));
    console.log(`📍 Regions covered: ${Object.keys(REGIONS_BY_PROVINCE).join(', ')}`);
    console.log(`🔍 Number of job searches: ${JOB_SEARCHES.length}`);
    console.log(`🏙️  Cities: ${ALL_CITIES.length} cities`);
    console.log('='.repeat(65));

    // First check server health
    console.log('\n🩺 Checking server health...');
    try {
        await postRequest('/api/health', {});
    } catch (err) {
        // health is a GET endpoint, not a problem if POST fails
    }

    let totalSaved = 0;
    let totalErrors = 0;
    const results = [];

    // For each job category, search across all regions (grouped by province for efficiency)
    for (let si = 0; si < JOB_SEARCHES.length; si++) {
        const search = JOB_SEARCHES[si];
        console.log(`\n[${si + 1}/${JOB_SEARCHES.length}] 🔍 Zoeken: "${search.label}"`);
        console.log(`   Keywords: "${search.keywords}"`);

        // Search across all regions at once (pass all cities as regions array)
        // We split into chunks of 5 cities per request to avoid overloading timeouts
        const CHUNK_SIZE = 5;
        for (let ci = 0; ci < ALL_CITIES.length; ci += CHUNK_SIZE) {
            const cityChunk = ALL_CITIES.slice(ci, ci + CHUNK_SIZE);
            console.log(`   📍 Steden: ${cityChunk.join(', ')}`);

            try {
                const result = await postRequest('/api/search/save', {
                    keywords: search.keywords,
                    regions: cityChunk,
                    country: 'BE',
                    count: 50,
                });

                if (result.status === 200 && result.body.success) {
                    const count = result.body.count || 0;
                    totalSaved += count;
                    console.log(`   ✅ ${count} vacatures opgeslagen`);
                    results.push({ search: search.label, cities: cityChunk.join(', '), saved: count, status: 'OK' });
                } else {
                    const msg = result.body.message || result.body.error || 'Unknown error';
                    console.log(`   ⚠️  Geen resultaten: ${msg}`);
                    results.push({ search: search.label, cities: cityChunk.join(', '), saved: 0, status: msg });
                }
            } catch (err) {
                totalErrors++;
                console.log(`   ❌ Fout: ${err.message}`);
                results.push({ search: search.label, cities: cityChunk.join(', '), saved: 0, status: `ERROR: ${err.message}` });
            }

            // Delay between chunks to avoid overwhelming the scraper
            if (ci + CHUNK_SIZE < ALL_CITIES.length) {
                console.log('   ⏳ Wachten 3s voor volgende batch...');
                await sleep(3000);
            }
        }

        // Delay between different job categories
        if (si < JOB_SEARCHES.length - 1) {
            console.log('\n   ⏳ Wachten 5s voor volgende zoekopdracht...');
            await sleep(5000);
        }
    }

    // =========================================================
    // SUMMARY REPORT
    // =========================================================
    console.log('\n' + '='.repeat(65));
    console.log('📊 EINDRAPPORT - Auto Vacancy Fill');
    console.log('='.repeat(65));
    console.log(`✅ Totaal opgeslagen vacatures:  ${totalSaved}`);
    console.log(`❌ Totaal fouten:                ${totalErrors}`);
    console.log(`🔍 Zoekopdrachten uitgevoerd:   ${JOB_SEARCHES.length}`);
    console.log(`🏙️  Regio's doorzocht:           ${Object.keys(REGIONS_BY_PROVINCE).join(', ')}`);

    console.log('\n📋 Gedetailleerde resultaten:');
    console.log('-'.repeat(65));
    for (const r of results) {
        const icon = r.saved > 0 ? '✅' : (r.status === 'OK' ? '🟡' : '❌');
        console.log(`${icon} [${r.search}] in [${r.cities}]: ${r.saved} opgeslagen`);
        if (r.status !== 'OK' && r.saved === 0) {
            console.log(`   └ Status: ${r.status}`);
        }
    }

    console.log('\n✨ Auto vacancy fill voltooid!');
}

main().catch(err => {
    console.error('💥 Onverwachte fout:', err);
    process.exit(1);
});
