/**
 * Belgian Regions Data for Frontend Autocomplete
 * 
 * All 134 Belgian cities + 10 provinces with French name mappings.
 * Sourced from backend/config/belgianCities.js
 */

export const PROVINCES = [
    { name: 'Antwerpen', type: 'province', frenchName: 'Anvers' },
    { name: 'Oost-Vlaanderen', type: 'province', frenchName: 'Flandre orientale' },
    { name: 'West-Vlaanderen', type: 'province', frenchName: 'Flandre occidentale' },
    { name: 'Vlaams-Brabant', type: 'province', frenchName: 'Brabant flamand' },
    { name: 'Limburg', type: 'province', frenchName: 'Limbourg' },
    { name: 'Henegouwen', type: 'province', frenchName: 'Hainaut' },
    { name: 'Luik', type: 'province', frenchName: 'Liège' },
    { name: 'Namen', type: 'province', frenchName: 'Namur' },
    { name: 'Waals-Brabant', type: 'province', frenchName: 'Brabant wallon' },
    { name: 'Luxemburg', type: 'province', frenchName: 'Luxembourg' },
    { name: 'Brussels', type: 'province', frenchName: 'Bruxelles' },
];

export const CITIES_BY_PROVINCE = {
    'Antwerpen': [
        { name: 'Antwerpen', frenchName: 'Anvers' },
        { name: 'Mechelen', frenchName: 'Malines' },
        { name: 'Turnhout', frenchName: '' },
        { name: 'Geel', frenchName: '' },
        { name: 'Lier', frenchName: '' },
        { name: 'Herentals', frenchName: '' },
        { name: 'Mortsel', frenchName: '' },
        { name: 'Hoogstraten', frenchName: '' },
    ],
    'Oost-Vlaanderen': [
        { name: 'Gent', frenchName: 'Gand' },
        { name: 'Aalst', frenchName: 'Alost' },
        { name: 'Sint-Niklaas', frenchName: '' },
        { name: 'Dendermonde', frenchName: 'Termonde' },
        { name: 'Deinze', frenchName: '' },
        { name: 'Lokeren', frenchName: 'Locres' },
        { name: 'Ninove', frenchName: '' },
        { name: 'Geraardsbergen', frenchName: 'Grammont' },
        { name: 'Oudenaarde', frenchName: 'Audenarde' },
        { name: 'Zottegem', frenchName: '' },
        { name: 'Ronse', frenchName: 'Renaix' },
        { name: 'Eeklo', frenchName: '' },
    ],
    'West-Vlaanderen': [
        { name: 'Brugge', frenchName: 'Bruges' },
        { name: 'Kortrijk', frenchName: 'Courtrai' },
        { name: 'Oostende', frenchName: 'Ostende' },
        { name: 'Roeselare', frenchName: '' },
        { name: 'Waregem', frenchName: '' },
        { name: 'Ieper', frenchName: 'Ypres' },
        { name: 'Menen', frenchName: 'Menin' },
        { name: 'Harelbeke', frenchName: '' },
        { name: 'Izegem', frenchName: '' },
        { name: 'Tielt', frenchName: '' },
        { name: 'Torhout', frenchName: '' },
        { name: 'Blankenberge', frenchName: '' },
        { name: 'Poperinge', frenchName: '' },
        { name: 'Wervik', frenchName: '' },
        { name: 'Diksmuide', frenchName: 'Dixmude' },
        { name: 'Veurne', frenchName: 'Furnes' },
        { name: 'Gistel', frenchName: '' },
        { name: 'Nieuwpoort', frenchName: 'Nieuport' },
        { name: 'Damme', frenchName: '' },
        { name: 'Oudenburg', frenchName: '' },
        { name: 'Lo-Reninge', frenchName: '' },
        { name: 'Mesen', frenchName: '' },
    ],
    'Vlaams-Brabant': [
        { name: 'Leuven', frenchName: 'Louvain' },
        { name: 'Vilvoorde', frenchName: 'Vilvorde' },
        { name: 'Halle', frenchName: 'Hal' },
        { name: 'Tienen', frenchName: 'Tirlemont' },
        { name: 'Aarschot', frenchName: '' },
        { name: 'Diest', frenchName: '' },
        { name: 'Scherpenheuvel-Zichem', frenchName: 'Montaigu-Zichem' },
        { name: 'Landen', frenchName: '' },
        { name: 'Zoutleeuw', frenchName: 'Léau' },
    ],
    'Limburg': [
        { name: 'Hasselt', frenchName: '' },
        { name: 'Genk', frenchName: '' },
        { name: 'Beringen', frenchName: '' },
        { name: 'Sint-Truiden', frenchName: 'Saint-Trond' },
        { name: 'Lommel', frenchName: '' },
        { name: 'Bilzen', frenchName: '' },
        { name: 'Tongeren', frenchName: 'Tongres' },
        { name: 'Maaseik', frenchName: '' },
        { name: 'Dilsen-Stokkem', frenchName: '' },
        { name: 'Peer', frenchName: '' },
        { name: 'Bree', frenchName: '' },
        { name: 'Herk-de-Stad', frenchName: 'Herck-la-Ville' },
        { name: 'Borgloon', frenchName: 'Looz' },
        { name: 'Halen', frenchName: '' },
        { name: 'Hamont-Achel', frenchName: '' },
    ],
    'Henegouwen': [
        { name: 'Charleroi', frenchName: '' },
        { name: 'Bergen', frenchName: 'Mons' },
        { name: 'La Louvière', frenchName: '' },
        { name: 'Doornik', frenchName: 'Tournai' },
        { name: 'Moeskroen', frenchName: 'Mouscron' },
        { name: 'Châtelet', frenchName: '' },
        { name: 'Binche', frenchName: '' },
        { name: 'Saint-Ghislain', frenchName: '' },
        { name: 'Fleurus', frenchName: '' },
        { name: "'s-Gravenbrakel", frenchName: 'Braine-le-Comte' },
        { name: 'Komen-Waasten', frenchName: 'Comines-Warneton' },
        { name: "Fontaine-l'Évêque", frenchName: '' },
        { name: 'Péruwelz', frenchName: '' },
        { name: 'Thuin', frenchName: '' },
        { name: 'Edingen', frenchName: 'Enghien' },
        { name: 'Leuze-en-Hainaut', frenchName: '' },
        { name: 'Zinnik', frenchName: 'Soignies' },
        { name: 'Lessen', frenchName: 'Lessines' },
        { name: 'Aat', frenchName: 'Ath' },
        { name: 'Antoing', frenchName: '' },
        { name: 'Beaumont', frenchName: '' },
        { name: 'Chièvres', frenchName: '' },
        { name: 'Chimay', frenchName: '' },
        { name: 'Le Rœulx', frenchName: '' },
        { name: 'Hannuit', frenchName: 'Hannut' },
    ],
    'Luik': [
        { name: 'Luik', frenchName: 'Liège' },
        { name: 'Seraing', frenchName: '' },
        { name: 'Verviers', frenchName: '' },
        { name: 'Herstal', frenchName: '' },
        { name: 'Hoei', frenchName: 'Huy' },
        { name: 'Eupen', frenchName: '' },
        { name: 'Wezet', frenchName: 'Visé' },
        { name: 'Herve', frenchName: '' },
        { name: 'Malmedy', frenchName: '' },
        { name: 'Spa', frenchName: '' },
        { name: 'Sankt Vith', frenchName: 'Saint-Vith' },
        { name: 'Stavelot', frenchName: '' },
        { name: 'Borgworm', frenchName: 'Waremme' },
        { name: 'Ans', frenchName: '' },
    ],
    'Namen': [
        { name: 'Namen', frenchName: 'Namur' },
        { name: 'Andenne', frenchName: '' },
        { name: 'Gembloers', frenchName: 'Gembloux' },
        { name: 'Ciney', frenchName: '' },
        { name: 'Dinant', frenchName: '' },
        { name: 'Rochefort', frenchName: '' },
        { name: 'Walcourt', frenchName: '' },
        { name: 'Couvin', frenchName: '' },
        { name: 'Philippeville', frenchName: '' },
        { name: 'Fosses-la-Ville', frenchName: '' },
        { name: 'Beauraing', frenchName: '' },
        { name: 'Sambreville', frenchName: '' },
    ],
    'Waals-Brabant': [
        { name: 'Waver', frenchName: 'Wavre' },
        { name: 'Nijvel', frenchName: 'Nivelles' },
        { name: 'Ottignies-Louvain-la-Neuve', frenchName: '' },
        { name: 'Geldenaken', frenchName: 'Jodoigne' },
        { name: 'Genepiën', frenchName: 'Genappe' },
        { name: 'Tubeke', frenchName: 'Tubize' },
    ],
    'Luxemburg': [
        { name: 'Aarlen', frenchName: 'Arlon' },
        { name: 'Bastenaken', frenchName: 'Bastogne' },
        { name: 'Marche-en-Famenne', frenchName: '' },
        { name: 'Durbuy', frenchName: '' },
        { name: 'Virton', frenchName: '' },
        { name: 'Neufchâteau', frenchName: '' },
        { name: 'Saint-Hubert', frenchName: '' },
        { name: 'Florenville', frenchName: '' },
        { name: 'Bouillon', frenchName: '' },
        { name: 'Chiny', frenchName: '' },
        { name: 'Houffalize', frenchName: '' },
        { name: 'La Roche-en-Ardenne', frenchName: '' },
        { name: 'Libramont-Chevigny', frenchName: '' },
        { name: 'Aubange', frenchName: '' },
    ],
    'Brussels': [
        { name: 'Brussel', frenchName: 'Bruxelles' },
    ],
};

/**
 * Get a flat list of all regions (provinces + cities) for autocomplete
 */
export function getAllRegions() {
    const regions = [];

    // Add provinces first
    for (const prov of PROVINCES) {
        regions.push({
            name: prov.name,
            type: 'province',
            province: prov.name,
            frenchName: prov.frenchName,
        });
    }

    // Add all cities
    for (const [provinceName, cities] of Object.entries(CITIES_BY_PROVINCE)) {
        for (const city of cities) {
            regions.push({
                name: city.name,
                type: 'city',
                province: provinceName,
                frenchName: city.frenchName,
            });
        }
    }

    return regions;
}

/**
 * Get all city names for a given province
 */
export function getCitiesForProvince(provinceName) {
    return (CITIES_BY_PROVINCE[provinceName] || []).map(c => c.name);
}

/**
 * Get all city names (flat array)
 */
export function getAllCityNames() {
    const names = [];
    for (const cities of Object.values(CITIES_BY_PROVINCE)) {
        for (const city of cities) {
            names.push(city.name);
        }
    }
    return names;
}
