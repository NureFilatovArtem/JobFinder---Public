/**
 * Input Sanitizer Service - Enterprise Grade
 * 
 * Features:
 * - Pre-compiled regex patterns (O(1) complexity)
 * - Word boundary matching (no false positives like Shell/Hell)
 * - No SQL injection check (parameterized queries handle this)
 * - Supports English, Dutch, and Ukrainian
 */

// ============================================
// FORBIDDEN WORDS LISTS
// ============================================

const FORBIDDEN_WORDS = {
    en: [
        // Slurs and hate speech
        'nigger', 'nigga', 'faggot', 'retard', 'retarded',
        // Vulgar terms
        'fuck', 'fucking', 'fucker', 'shit', 'cunt', 'asshole', 'bitch',
        // Discriminatory terms
        'kike', 'chink', 'spic', 'wetback', 'gook'
    ],
    nl: [
        // Dutch offensive terms
        'kanker', 'kankeren', 'mongool', 'teringlijer', 'hoer',
        'klootzak', 'godverdomme', 'kutwijf', 'tyfushoer', 'tering',
        'nikker', 'spleetoog', 'flikker', 'moffenhoer', 'rotmof'
    ],
    uk: [
        // Ukrainian offensive terms (Cyrillic)
        'сука', 'бляд', 'блядь', 'хуй', 'пизд', 'їбат',
        'курва', 'йобан', 'мудак', 'залупа', 'дебіл',
        'чурка', 'хохол', 'москаль', 'жид', 'підарас'
    ]
};

// ============================================
// PRE-COMPILED REGEX PATTERNS (Performance)
// ============================================
// Built ONCE at module load, not on every request
// Uses word boundaries (\b) to prevent false positives (Shell ≠ Hell)

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const FORBIDDEN_PATTERNS = {
    en: new RegExp(`\\b(${FORBIDDEN_WORDS.en.map(escapeRegex).join('|')})\\b`, 'i'),
    nl: new RegExp(`\\b(${FORBIDDEN_WORDS.nl.map(escapeRegex).join('|')})\\b`, 'i'),
    uk: new RegExp(`\\b(${FORBIDDEN_WORDS.uk.map(escapeRegex).join('|')})\\b`, 'i')
};

// Combined pattern for quick "any language" check
const ALL_FORBIDDEN_PATTERN = new RegExp(
    `\\b(${[
        ...FORBIDDEN_WORDS.en,
        ...FORBIDDEN_WORDS.nl,
        ...FORBIDDEN_WORDS.uk
    ].map(escapeRegex).join('|')})\\b`,
    'i'
);

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
    const dutchPatterns = /\b(van|het|een|voor|met|naar|bij|uit|tot|als|dat|niet|maar|ook|nog|wel|haar|zijn|zij|wij|deze|die|wat|wie|waar|wanneer|hoe|waarom|omdat|dus|toen|nu|dan|zo|erg|heel|zeer|veel)\b/i;
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
// FORBIDDEN WORD CHECKING (O(1) Complexity)
// ============================================

/**
 * Check if text contains forbidden words using pre-compiled regex
 * Returns: { hasForbidden: boolean, blockedWords: string[], detectedLanguage: string }
 */
function checkForbiddenWords(text, language = null) {
    if (!text) return { hasForbidden: false, blockedWords: [], detectedLanguage: 'en' };

    const detectedLang = language || detectLanguage(text);
    const blockedWords = [];

    // Quick check using combined pattern first
    if (!ALL_FORBIDDEN_PATTERN.test(text)) {
        return {
            hasForbidden: false,
            blockedWords: [],
            detectedLanguage: detectedLang
        };
    }

    // Found a match - now identify which words
    // Check each language pattern to find the actual matches
    for (const [lang, pattern] of Object.entries(FORBIDDEN_PATTERNS)) {
        const match = text.match(pattern);
        if (match) {
            blockedWords.push(match[0]);
        }
    }

    return {
        hasForbidden: blockedWords.length > 0,
        blockedWords: [...new Set(blockedWords)], // Deduplicate
        detectedLanguage: detectedLang
    };
}

// ============================================
// SEARCH QUERY SANITIZATION
// ============================================

/**
 * Sanitize a search query
 * Returns: { 
 *   isValid: boolean, 
 *   sanitized: string, 
 *   blockedWords: string[], 
 *   error: string | null,
 *   detectedLanguage: string 
 * }
 */
function sanitizeSearchQuery(query) {
    if (!query || typeof query !== 'string') {
        return {
            isValid: false,
            sanitized: '',
            blockedWords: [],
            error: 'Query is required and must be a string',
            detectedLanguage: 'en'
        };
    }

    // Trim and normalize whitespace
    let sanitized = query.trim().replace(/\s+/g, ' ');

    // Check length
    if (sanitized.length < 2) {
        return {
            isValid: false,
            sanitized,
            blockedWords: [],
            error: 'Query must be at least 2 characters',
            detectedLanguage: detectLanguage(sanitized)
        };
    }

    if (sanitized.length > 200) {
        return {
            isValid: false,
            sanitized: sanitized.substring(0, 200),
            blockedWords: [],
            error: 'Query must be 200 characters or less',
            detectedLanguage: detectLanguage(sanitized)
        };
    }

    // Detect language
    const detectedLanguage = detectLanguage(sanitized);

    // Check for forbidden words using pre-compiled regex
    const forbiddenCheck = checkForbiddenWords(sanitized);
    if (forbiddenCheck.hasForbidden) {
        return {
            isValid: false,
            sanitized,
            blockedWords: forbiddenCheck.blockedWords,
            error: 'Query contains forbidden content',
            detectedLanguage
        };
    }

    // NOTE: SQL injection check removed - parameterized queries handle this
    // Adding keyword checks for "SELECT", "DROP" etc. creates false positives
    // for legitimate job searches like "SQL Developer" or "SELECT queries"

    return {
        isValid: true,
        sanitized,
        blockedWords: [],
        error: null,
        detectedLanguage
    };
}

// ============================================
// VACANCY DATA VALIDATION
// ============================================

/**
 * Validate vacancy import data
 * Returns: { isValid: boolean, errors: string[] }
 */
function validateVacancyImport(vacancy) {
    const errors = [];

    if (!vacancy || typeof vacancy !== 'object') {
        return { isValid: false, errors: ['Invalid vacancy object'] };
    }

    // Required fields
    if (!vacancy.title || typeof vacancy.title !== 'string' || vacancy.title.trim().length < 2) {
        errors.push('Title is required and must be at least 2 characters');
    }

    if (!vacancy.source_url || typeof vacancy.source_url !== 'string') {
        errors.push('source_url is required');
    } else {
        // Validate URL format
        try {
            new URL(vacancy.source_url);
        } catch {
            errors.push('source_url must be a valid URL');
        }
    }

    // Check for blocked content in title and description
    if (vacancy.title) {
        const titleCheck = checkForbiddenWords(vacancy.title);
        if (titleCheck.hasForbidden) {
            errors.push('Title contains forbidden content');
        }
    }

    if (vacancy.description) {
        const descCheck = checkForbiddenWords(vacancy.description);
        if (descCheck.hasForbidden) {
            errors.push('Description contains forbidden content');
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Sanitize vacancy data for storage
 * Returns: { data: object, hasBlockedContent: boolean }
 */
function sanitizeVacancyData(vacancy) {
    const sanitized = { ...vacancy };
    let hasBlockedContent = false;

    // Sanitize string fields
    const stringFields = ['title', 'company', 'location', 'description'];
    for (const field of stringFields) {
        if (sanitized[field] && typeof sanitized[field] === 'string') {
            sanitized[field] = sanitized[field].trim().replace(/\s+/g, ' ');

            // Check for forbidden content using pre-compiled regex
            const check = checkForbiddenWords(sanitized[field]);
            if (check.hasForbidden) {
                hasBlockedContent = true;
            }
        }
    }

    // Validate and clean URL
    if (sanitized.source_url) {
        try {
            const url = new URL(sanitized.source_url);
            sanitized.source_url = url.toString();
        } catch {
            // Keep original if parsing fails
        }
    }

    return {
        data: sanitized,
        hasBlockedContent
    };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Add words to forbidden list dynamically
 * Note: This will NOT update pre-compiled patterns at runtime
 * Use only for testing or add to FORBIDDEN_WORDS and rebuild patterns
 */
function addForbiddenWord(word, language = 'en') {
    if (FORBIDDEN_WORDS[language] && !FORBIDDEN_WORDS[language].includes(word.toLowerCase())) {
        FORBIDDEN_WORDS[language].push(word.toLowerCase());
        console.warn(`⚠️ Word added to forbidden list but pattern not rebuilt. Restart server for full effect.`);
    }
}

/**
 * Get current forbidden words configuration
 */
function getForbiddenWordsConfig() {
    return {
        en: FORBIDDEN_WORDS.en.length,
        nl: FORBIDDEN_WORDS.nl.length,
        uk: FORBIDDEN_WORDS.uk.length
    };
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    detectLanguage,
    checkForbiddenWords,
    sanitizeSearchQuery,
    validateVacancyImport,
    sanitizeVacancyData,
    addForbiddenWord,
    getForbiddenWordsConfig
};
