// Search enhancement service for multilingual synonyms and keyword expansion
// Supports English, Dutch, and Ukrainian

// ============================================
// SYNONYM DICTIONARIES
// ============================================

// Dutch and English job-related synonyms
const SYNONYMS_NL_EN = {
  // Sales/Retail
  'verkoper': ['verkoop', 'sales', 'verkoopmedewerker', 'winkelmedewerker', 'retail', 'shop assistant', 'sales assistant'],
  'verkopster': ['verkoper', 'verkoop', 'sales', 'verkoopmedewerker', 'winkelmedewerker', 'retail'],
  'winkelmedewerker': ['verkoper', 'verkoopmedewerker', 'retail medewerker', 'shop assistant', 'winkelbediende', 'verkoop', 'sales'],
  'sales': ['verkoper', 'verkoop', 'sales assistant', 'retail', 'shop assistant'],
  'retail': ['winkel', 'verkoop', 'shop', 'retail worker', 'sales'],
  'shop assistant': ['winkelmedewerker', 'verkoper', 'sales assistant', 'retail worker'],
  'cashier': ['kassier', 'kassierster', 'kassamedewerker', 'kassa medewerker'],
  'kassier': ['kassierster', 'kassamedewerker', 'cashier', 'kassa medewerker'],

  // Warehouse/Stock
  'vakkenvuller': ['magazijnmedewerker', 'warehouse', 'stock', 'voorraad', 'magazijn', 'warehouse worker'],
  'magazijnmedewerker': ['vakkenvuller', 'warehouse medewerker', 'voorraadmedewerker', 'stock medewerker', 'warehouse worker'],
  'warehouse': ['magazijn', 'warehouse worker', 'stock', 'logistics'],

  // Customer Service
  'klantenservice': ['customer service', 'klantadviseur', 'helpdesk', 'service medewerker', 'customer support'],
  'customer service': ['klantenservice', 'customer support', 'helpdesk'],

  // Job Types
  'parttime': ['deeltijds', 'part-time', 'part time', 'flexibel', 'flexible'],
  'fulltime': ['voltijds', 'full-time', 'full time', 'volledig'],

  // Time-related
  'weekend': ['weekendwerk', 'zaterdag', 'zondag', 'weekend work', 'saturday', 'sunday'],
  'student': ['studentenjob', 'student job', 'bijbaan'],
  'bijbaan': ['studentenjob', 'student job', 'parttime', 'part-time job'],

  // Horeca
  'horeca': ['restaurant', 'cafe', 'bar', 'keuken', 'hospitality'],
  'hospitality': ['horeca', 'restaurant', 'cafe', 'bar'],
  'keuken': ['keukenmedewerker', 'kok', 'kitchen', 'kitchen worker', 'cook'],
  'bediening': ['server', 'ober', 'serveerster', 'waiter', 'waitress'],

  // Cleaning
  'schoonmaker': ['schoonmaak', 'cleaning', 'schoonmaakmedewerker', 'cleaner'],
  'cleaning': ['schoonmaak', 'cleaner', 'cleaning worker'],

  // Security
  'beveiliging': ['security', 'beveiliger', 'bewaker', 'security guard'],
  'security': ['beveiliging', 'security guard', 'beveiliger'],

  // Administration
  'administratie': ['admin', 'administratief', 'office', 'kantoor', 'administration'],
  'office': ['kantoor', 'office worker', 'administration'],

  // Logistics
  'logistiek': ['logistics', 'logistiek medewerker', 'warehouse', 'distributie'],
  'logistics': ['logistiek', 'warehouse', 'distribution'],

  // IT/Development
  'developer': ['ontwikkelaar', 'programmer', 'software engineer', 'software developer'],
  'ontwikkelaar': ['developer', 'programmeur', 'software engineer'],
  'programmer': ['programmeur', 'developer', 'ontwikkelaar', 'software developer'],
  'software engineer': ['developer', 'ontwikkelaar', 'software developer'],

  // General
  'werk': ['job', 'vacature', 'baan', 'work', 'vacancy'],
  'baan': ['job', 'vacature', 'werk', 'work', 'vacancy'],
  'job': ['vacature', 'werk', 'baan', 'work', 'vacancy']
};

// Ukrainian synonyms with cross-language mappings
const SYNONYMS_UK = {
  // IT/Development
  'програміст': ['developer', 'programmer', 'ontwikkelaar', 'розробник', 'software engineer', 'software developer'],
  'розробник': ['developer', 'programmer', 'ontwikkelaar', 'програміст', 'software engineer'],
  'інженер': ['engineer', 'ingenieur', 'developer', 'software engineer'],
  'айтішник': ['developer', 'programmer', 'it specialist', 'it medewerker'],

  // Sales/Retail
  'продавець': ['verkoper', 'sales', 'shop assistant', 'sales assistant', 'консультант'],
  'консультант': ['advisor', 'consultant', 'adviseur', 'продавець', 'klantadviseur'],
  'касир': ['kassier', 'cashier', 'касирка', 'kassa medewerker'],

  // Warehouse/Logistics
  'складський': ['warehouse', 'magazijn', 'warehouse worker', 'magazijnmedewerker', 'склад'],
  'логіст': ['logistiek', 'logistics', 'logistiek medewerker', 'distribution'],
  'вантажник': ['loader', 'warehouse worker', 'magazijnmedewerker'],

  // Food/Hospitality
  'офіціант': ['waiter', 'ober', 'server', 'bediening', 'serveerster'],
  'кухар': ['cook', 'kok', 'chef', 'keuken', 'keukenmedewerker'],
  'бармен': ['bartender', 'barman', 'bar', 'barkeeper'],
  'повар': ['cook', 'kok', 'chef', 'keuken'],

  // Cleaning
  'прибиральник': ['cleaner', 'schoonmaker', 'cleaning', 'schoonmaak'],
  'прибиральниця': ['cleaner', 'schoonmaker', 'cleaning worker'],

  // Security
  'охоронець': ['security', 'beveiliging', 'security guard', 'beveiliger'],
  'охорона': ['security', 'beveiliging', 'bewaker'],

  // Administration
  'адміністратор': ['administrator', 'admin', 'administratie', 'office manager'],
  'секретар': ['secretary', 'secretaris', 'office', 'kantoor'],
  'бухгалтер': ['accountant', 'boekhouder', 'finance', 'accounting'],

  // Medical
  'медсестра': ['nurse', 'verpleegster', 'verpleegkundige', 'healthcare'],
  'лікар': ['doctor', 'arts', 'physician', 'healthcare'],

  // General work terms
  'робота': ['werk', 'job', 'work', 'baan', 'vacature'],
  'вакансія': ['vacancy', 'vacature', 'job', 'opening'],
  'підробіток': ['bijbaan', 'part-time', 'parttime', 'student job'],
  'студент': ['student', 'student job', 'studentenjob', 'bijbaan'],

  // Employment types
  'повна зайнятість': ['fulltime', 'full-time', 'voltijds', 'full time'],
  'часткова зайнятість': ['parttime', 'part-time', 'deeltijds', 'part time'],
  'віддалена': ['remote', 'thuiswerk', 'work from home', 'remote work'],

  // Driver/Transport
  'водій': ['driver', 'chauffeur', 'bezorger', 'delivery'],
  'курєр': ['courier', 'bezorger', 'delivery', 'delivery driver']
};

// Merge all synonyms into one dictionary
const ALL_SYNONYMS = { ...SYNONYMS_NL_EN, ...SYNONYMS_UK };

// ============================================
// LANGUAGE DETECTION
// ============================================

/**
 * Detect the primary language of input text
 * Returns: 'uk' | 'nl' | 'en'
 */
function detectLanguage(text) {
  if (!text) return 'en';

  // Ukrainian detection (Cyrillic with Ukrainian-specific letters)
  const hasCyrillic = /[а-яА-ЯіїєґІЇЄҐ]/.test(text);
  const hasUkrainianSpecific = /[іїєґІЇЄҐ]/.test(text);
  const hasRussianSpecific = /[ыэъЫЭЪ]/.test(text);

  if (hasCyrillic && (hasUkrainianSpecific || !hasRussianSpecific)) {
    return 'uk';
  }

  // Dutch detection (common Dutch patterns)
  const dutchPatterns = /\b(van|het|een|voor|met|naar|bij|uit|tot|als|dat|niet|maar|ook|nog|wel|haar|zijn|zij|wij|deze|die|wat|wie|waar|wanneer|hoe|waarom|omdat|dus|toen|nu|dan|zo|erg|heel|zeer|veel|ij|ee|oo|aa|uu|eu|ui|oe|ie)\b/i;
  if (dutchPatterns.test(text)) {
    return 'nl';
  }

  // Check for Dutch-specific letter combinations
  const dutchCombinations = /\b\w*(ij|oo|ee|aa|uu|eu|ui|oe|ie)\w*\b/i;
  if (dutchCombinations.test(text) && /[a-z]/i.test(text)) {
    return 'nl';
  }

  // Default to English
  return 'en';
}

// ============================================
// SYNONYM FUNCTIONS
// ============================================

/**
 * Get synonyms for a word (all languages)
 */
function getSynonyms(word) {
  const lowerWord = word.toLowerCase().trim();
  const synonyms = ALL_SYNONYMS[lowerWord] || [];
  return [...new Set([lowerWord, ...synonyms])];
}

/**
 * Get synonyms specifically for the detected language
 */
function getSynonymsByLanguage(word, language) {
  const lowerWord = word.toLowerCase().trim();
  let synonyms = [];

  if (language === 'uk') {
    synonyms = SYNONYMS_UK[lowerWord] || [];
  } else {
    synonyms = SYNONYMS_NL_EN[lowerWord] || [];
  }

  // Also check the other dictionary for cross-language matches
  const otherSynonyms = language === 'uk'
    ? SYNONYMS_NL_EN[lowerWord] || []
    : SYNONYMS_UK[lowerWord] || [];

  return [...new Set([lowerWord, ...synonyms, ...otherSynonyms])];
}

/**
 * Expand keywords with synonyms
 */
function expandKeywords(keywords, language = null) {
  const detectedLang = language || detectLanguage(keywords);
  const words = keywords.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const expanded = new Set();

  // Add original keywords
  words.forEach(word => expanded.add(word));

  // Add synonyms for each word
  words.forEach(word => {
    const synonyms = getSynonymsByLanguage(word, detectedLang);
    synonyms.forEach(syn => expanded.add(syn));
  });

  // Add full phrase
  if (words.length > 1) {
    expanded.add(words.join(' '));
  }

  return Array.from(expanded);
}

// ============================================
// SEARCH QUERY GENERATION
// ============================================

/**
 * Generate search combinations from keywords
 */
function generateSearchTerms(keywords, language = null) {
  const original = keywords.trim();
  if (!original) return [];

  const detectedLang = language || detectLanguage(original);
  const searchTerms = new Set();

  // Add original
  searchTerms.add(original);

  // Split into words
  const words = original.toLowerCase().split(/\s+/).filter(w => w.length > 1);

  if (words.length === 0) {
    return [original];
  }

  // Add each word individually with synonyms
  words.forEach(word => {
    searchTerms.add(word);
    const synonyms = getSynonymsByLanguage(word, detectedLang);
    synonyms.forEach(syn => searchTerms.add(syn));
  });

  // If multiple words, add combinations
  if (words.length > 1) {
    searchTerms.add(words.join(' '));

    // Create variations with synonyms
    words.forEach((word, index) => {
      const synonyms = getSynonymsByLanguage(word, detectedLang);
      synonyms.slice(0, 3).forEach(syn => { // Limit to 3 synonyms per word
        const modified = [...words];
        modified[index] = syn;
        searchTerms.add(modified.join(' '));
      });
    });
  }

  // Add cross-language translations for common terms
  const translations = getTranslations(original, detectedLang);
  translations.forEach(t => searchTerms.add(t));

  return Array.from(searchTerms).filter(term => term.length > 0);
}

/**
 * Get translations for common job terms
 */
function getTranslations(phrase, sourceLanguage) {
  const translations = [];
  const lowerPhrase = phrase.toLowerCase();

  // Predefined phrase translations
  const phraseTranslations = {
    // Ukrainian -> Dutch/English
    'програміст': ['developer', 'software developer', 'ontwikkelaar'],
    'розробник': ['developer', 'programmer', 'ontwikkelaar'],
    'продавець': ['verkoper', 'sales', 'shop assistant'],
    'робота': ['job', 'werk', 'vacature'],
    'вакансія': ['vacancy', 'vacature', 'job opening'],

    // Dutch -> English
    'verkoper parttime': ['sales part-time', 'retail part-time'],
    'winkelmedewerker': ['shop assistant', 'retail worker'],
    'magazijnmedewerker': ['warehouse worker', 'stock worker'],

    // English -> Dutch
    'developer': ['ontwikkelaar', 'programmeur'],
    'warehouse worker': ['magazijnmedewerker', 'warehouse medewerker'],
    'cashier': ['kassier', 'kassamedewerker']
  };

  if (phraseTranslations[lowerPhrase]) {
    translations.push(...phraseTranslations[lowerPhrase]);
  }

  return translations;
}

/**
 * Generate all possible search queries with synonym expansion
 */
function generateAllSearchQueries(keywords, maxQueries = 20) {
  const detectedLang = detectLanguage(keywords);
  const terms = generateSearchTerms(keywords, detectedLang);
  const queries = new Set();

  terms.forEach(term => {
    queries.add(term);
    // Also add variations
    const expanded = expandKeywords(term, detectedLang);
    expanded.slice(0, 5).forEach(e => queries.add(e)); // Limit expansions
  });

  // Prioritize: original first, then by relevance
  const prioritized = [];
  const original = keywords.toLowerCase().trim();
  prioritized.push(original);

  // Add other unique terms
  Array.from(queries).forEach(q => {
    if (q !== original && !prioritized.includes(q)) {
      prioritized.push(q);
    }
  });

  return prioritized.slice(0, maxQueries);
}

/**
 * Add English variations for common job terms (legacy support)
 */
function addEnglishVariations(keywords) {
  const variations = [];
  const lower = keywords.toLowerCase();

  const mappings = {
    'verkoper': ['sales', 'retail', 'shop assistant'],
    'winkel': ['shop', 'retail'],
    'kassier': ['cashier'],
    'magazijn': ['warehouse', 'stock'],
    'vakkenvuller': ['warehouse', 'stock'],
    'klantenservice': ['customer service'],
    'parttime': ['part-time', 'part time'],
    'weekend': ['weekend work'],
    'student': ['student job'],
    'bijbaan': ['student job'],
    'horeca': ['hospitality', 'restaurant'],
    'keuken': ['kitchen'],
    'bediening': ['waiter', 'waitress', 'server'],
    'schoonmaak': ['cleaning'],
    'beveiliging': ['security'],
    // Ukrainian terms
    'програміст': ['developer', 'programmer'],
    'розробник': ['developer', 'programmer'],
    'продавець': ['sales', 'shop assistant'],
    'офіціант': ['waiter', 'server'],
    'кухар': ['cook', 'chef']
  };

  for (const [term, englishTerms] of Object.entries(mappings)) {
    if (lower.includes(term)) {
      variations.push(...englishTerms);
    }
  }

  return variations;
}

/**
 * Translate common Dutch phrases to English (legacy support)
 */
function translateToEnglish(phrase) {
  const translations = {
    'verkoper parttime': ['sales part-time', 'sales parttime', 'retail part-time'],
    'winkelmedewerker parttime': ['shop assistant part-time', 'retail worker part-time'],
    'kassier parttime': ['cashier part-time', 'cashier parttime'],
    'student job': ['studentenjob', 'bijbaan'],
    'weekend work': ['weekendwerk'],
    'customer service': ['klantenservice'],
    'warehouse worker': ['magazijnmedewerker']
  };

  return translations[phrase.toLowerCase()] || [];
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  detectLanguage,
  getSynonyms,
  getSynonymsByLanguage,
  expandKeywords,
  generateSearchTerms,
  generateAllSearchQueries,
  translateToEnglish,
  addEnglishVariations,
  getTranslations,
  // Export dictionaries for testing
  SYNONYMS_NL_EN,
  SYNONYMS_UK,
  ALL_SYNONYMS
};
