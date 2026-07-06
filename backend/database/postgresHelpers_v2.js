// PostgreSQL Database Helper Functions v2
// Для покращеної схеми з нормалізацією
const { query, getClient } = require('./postgres');
const {
    normalizeDedupField,
    normalizeCity,
    generateSourceId,
    generateSafeDedupKey,
    hasEnoughDataForBusinessDedup
} = require('../services/vacancyNormalizer');
const { classifyVacancy, detectEmploymentType } = require('../config/jobCategories');

/**
 * Екстрактити локацію з опису вакансії
 * Наприклад: "2018 Antwerpen Voltijds+2Bedrijfsfeesten..." → city: "Antwerpen", postcode: "2018"
 */
const extractLocationFromDescription = (description) => {
    if (!description) return { city: null, postcode: null, cleanedDescription: description };

    // Паттерни для бельгійських поштових кодів + міста  
    const locationPatterns = [
        /^(\d{4})\s+(Antwerpen|Antwerp|Brussels|Brussel|Ghent|Gent|Liège|Luik|Brugge|Bruges|Leuven|Mechelen|Aalst|Hasselt)\b/i,
        /^(\d{4})\s+([A-Z][a-zèéêëàâäôöûüïî-]+)\b/i,  // Generic: postcode + capitalized city
    ];

    for (const pattern of locationPatterns) {
        const match = description.trim().match(pattern);
        if (match) {
            const postcode = match[1];
            const city = match[2];
            // Видалити локацію з початку опису
            const cleanedDescription = description.replace(pattern, '').trim();
            return { city, postcode, cleanedDescription };
        }
    }

    // Якщо не знайдено на початку, спробувати знайти БУДЬ-ДЕ в описі
    const postcodeMatch = description.match(/\b(\d{4})\s+(Antwerpen|Antwerp|Brussels|Brussel|Ghent|Gent)\b/i);
    if (postcodeMatch) {
        const postcode = postcodeMatch[1];
        const city = postcodeMatch[2];
        const cleanedDescription = description.replace(postcodeMatch[0], '').trim();
        return { city, postcode, cleanedDescription };
    }

    return { city: null, postcode: null, cleanedDescription: description };
};

/**
 * Мапити legacy поля на нову схему
 */
const mapLegacyVacancyFields = (vacancyData) => {
    const mapped = { ...vacancyData };

    // Map старих назв полів
    if (mapped.source_site && !mapped.source) {
        mapped.source = mapped.source_site;
        delete mapped.source_site;
    }

    // Mapper всі варіанти URL полів
    if (mapped.url && !mapped.source_url) {
        mapped.source_url = mapped.url;
    }

    if (mapped.link && !mapped.source_url) {
        mapped.source_url = mapped.link;
    }

    // Також зберегти link для backward compatibility
    if (mapped.source_url && !mapped.link) {
        mapped.link = mapped.source_url;
    }

    // Переконатися, що source_url існує
    if (!mapped.source_url) {
        mapped.source_url = mapped.link || mapped.url || '';
    }

    // Екстрактити локацію з опису, якщо є
    if (mapped.description && !mapped.city) {
        const extracted = extractLocationFromDescription(mapped.description);
        if (extracted.city) {
            mapped.city = extracted.city;
            mapped.postcode = extracted.postcode;
            mapped.description = extracted.cleanedDescription;
            console.log(`Extracted location from description: ${extracted.postcode} ${extracted.city}`);
        }
    }

    // Якщо location містить postcode, витягнути окремо
    if (mapped.location && !mapped.city) {
        const locationMatch = mapped.location.match(/^(\d{4})\s+(.+)$/);
        if (locationMatch) {
            mapped.postcode = locationMatch[1];
            mapped.city = locationMatch[2];
        } else {
            mapped.city = mapped.location;
        }
    }

    return mapped;
};

/**
 * Знайти або створити країну за кодом або назвою
 */
async function findOrCreateCountry(countryInput) {
    if (!countryInput) return null;

    // Спробувати знайти за кодом (якщо це 2-3 літери)
    if (typeof countryInput === 'string' && countryInput.length <= 3) {
        const result = await query(
            'SELECT id FROM countries WHERE code = $1',
            [countryInput.toUpperCase()]
        );
        if (result.rows.length > 0) return result.rows[0].id;
    }

    // Спробувати знайти за назвою
    const result = await query(
        'SELECT id FROM countries WHERE LOWER(name) = LOWER($1)',
        [countryInput]
    );
    if (result.rows.length > 0) return result.rows[0].id;

    return null; // Не створювати нові країни автоматично
}

/**
 * Знайти або створити місто
 */
async function findOrCreateCity(cityName, countryId) {
    if (!cityName || !countryId) return null;

    // Спробувати знайти
    let result = await query(
        'SELECT id FROM cities WHERE country_id = $1 AND LOWER(name) = LOWER($2)',
        [countryId, cityName]
    );

    if (result.rows.length > 0) {
        return result.rows[0].id;
    }

    // Створити нове місто
    result = await query(
        'INSERT INTO cities (country_id, name) VALUES ($1, $2) ON CONFLICT (country_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
        [countryId, cityName]
    );

    return result.rows[0].id;
}

/**
 * Знайти або створити компанію
 */
async function findOrCreateCompany(companyInput, countryId = null) {
    if (!companyInput) return null;

    const companyName = typeof companyInput === 'string' ? companyInput : companyInput.name;
    if (!companyName) return null;

    // Спробувати знайти
    let result = await query(
        'SELECT id FROM companies WHERE LOWER(name) = LOWER($1)',
        [companyName]
    );

    if (result.rows.length > 0) {
        return result.rows[0].id;
    }

    // Створити slug
    const slug = companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    // Створити нову компанію
    try {
        result = await query(
            `INSERT INTO companies (name, slug, country_id) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name 
       RETURNING id`,
            [companyName, slug, countryId]
        );
        return result.rows[0].id;
    } catch (error) {
        console.error('Error creating company:', error);
        return null;
    }
}

const dbHelpers = {
    // ============================================
    // КОРИСТУВАЧІ
    // ============================================

    /**
     * Отримати користувача за ID
     */
    getUserById: async (id) => {
        const result = await query('SELECT * FROM users WHERE id = $1', [id]);
        return result.rows[0];
    },

    /**
     * Отримати користувача за email
     */
    getUserByEmail: async (email) => {
        const result = await query('SELECT * FROM users WHERE email = $1', [email]);
        return result.rows[0];
    },

    /**
     * Створити нового користувача
     */
    createUser: async (userData) => {
        const {
            email,
            password_hash,
            name = '',
            phone = null,
            skills = [],
            personality = '',
            availability = '',
            languages = ['en'],
            ui_language = 'en'
        } = userData;

        const result = await query(
            `INSERT INTO users (email, password_hash, name, phone, skills, personality, availability, languages, ui_language)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
            [email, password_hash, name, phone, skills, personality, availability, languages, ui_language]
        );
        return result.rows[0];
    },

    /**
     * Оновити користувача
     */
    updateUser: async (id, userData) => {
        const fields = [];
        const values = [];
        let paramIndex = 1;

        const allowedFields = [
            'name', 'phone', 'skills', 'personality', 'availability',
            'languages', 'experience', 'preferred_country_ids', 'preferred_city_ids',
            'preferred_contract_types', 'preferred_job_types',
            'expected_salary_min', 'expected_salary_max', 'expected_salary_currency',
            'notification_settings', 'ui_language'
        ];

        for (const field of allowedFields) {
            if (userData[field] !== undefined) {
                fields.push(`${field} = $${paramIndex}`);
                values.push(userData[field]);
                paramIndex++;
            }
        }

        if (fields.length === 0) {
            return await dbHelpers.getUserById(id);
        }

        values.push(id);
        const result = await query(
            `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );
        return result.rows[0];
    },

    // ============================================
    // ПРОФІЛЬ (для backward compatibility)
    // ============================================

    getProfile: async (userId) => {
        if (!userId) throw new Error('userId is required for getProfile');
        const user = await dbHelpers.getUserById(userId);
        if (!user) return null;
        return user;
    },

    updateProfile: async (userId, profileData) => {
        if (!userId) throw new Error('userId is required for updateProfile');
        return await dbHelpers.updateUser(userId, profileData);
    },

    // ============================================
    // КОМПАНІЇ
    // ============================================

    /**
     * Отримати всі компанії
     */
    getAllCompanies: async (filters = {}) => {
        let queryText = 'SELECT * FROM companies WHERE is_active = true';
        const params = [];

        if (filters.country_id) {
            params.push(filters.country_id);
            queryText += ` AND country_id = $${params.length}`;
        }

        queryText += ' ORDER BY name';

        const result = await query(queryText, params);
        return result.rows;
    },

    /**
     * Отримати компанію за ID
     */
    getCompanyById: async (id) => {
        const result = await query('SELECT * FROM companies WHERE id = $1', [id]);
        return result.rows[0];
    },

    // ============================================
    // ВАКАНСІЇ - ГЛОБАЛЬНА БАЗА
    // ============================================

    /**
     * Отримати всі вакансії з фільтрами
     */
    getAllVacatures: async (filters = {}, userId = null) => {
        let queryText = `
      SELECT 
        v.*,
       v.source_url as link,
        co.name as country_name,
        co.code as country_code,
        ci.name as city_name,
        comp.name as company_full_name,
        comp.logo_url as company_logo
    `;

        if (userId) {
            queryText += `,
        uvs.match_score,
        uvs.is_interesting,
        uvs.is_applied,
        uvs.is_saved,
        uvs.is_hidden,
        uvs.is_hidden,
        uvs.application_status,
        uvs.match_details
      `;
        }

        queryText += `
      FROM vacancies v
      LEFT JOIN countries co ON v.country_id = co.id
      LEFT JOIN cities ci ON v.city_id = ci.id
      LEFT JOIN companies comp ON v.company_id = comp.id
    `;

        if (userId) {
            queryText += `
        LEFT JOIN user_vacancy_scores uvs ON v.id = uvs.vacancy_id AND uvs.user_id = $1
      `;
        }

        const params = userId ? [userId] : [];
        const conditions = ['v.is_active = true'];
        let paramIndex = params.length + 1;

        if (filters.status) {
            // Backward compatibility: status може бути в user_vacancy_scores
            if (userId) {
                conditions.push(`uvs.application_status = $${paramIndex}`);
            }
            params.push(filters.status);
            paramIndex++;
        }

        if (filters.country) {
            conditions.push(`(co.code = $${paramIndex} OR co.name ILIKE $${paramIndex + 1})`);
            params.push(filters.country, `%${filters.country}%`);
            paramIndex += 2;
        }

        if (filters.country_id) {
            conditions.push(`v.country_id = $${paramIndex}`);
            params.push(filters.country_id);
            paramIndex++;
        }

        if (filters.city_id) {
            conditions.push(`v.city_id = $${paramIndex}`);
            params.push(filters.city_id);
            paramIndex++;
        }

        if (filters.sources && Array.isArray(filters.sources) && filters.sources.length > 0) {
            const placeholders = filters.sources.map((_, i) => `$${paramIndex + i}`).join(', ');
            conditions.push(`v.source IN (${placeholders})`);
            params.push(...filters.sources);
            paramIndex += filters.sources.length;
        } else if (filters.source) {
            conditions.push(`v.source = $${paramIndex}`);
            params.push(filters.source);
            paramIndex++;
        }

        if (filters.contract_type) {
            conditions.push(`v.contract_type = $${paramIndex}`);
            params.push(filters.contract_type);
            paramIndex++;
        }

        if (filters.job_type) {
            conditions.push(`v.job_type = $${paramIndex}`);
            params.push(filters.job_type);
            paramIndex++;
        }

        if (filters.is_remote !== undefined) {
            conditions.push(`v.is_remote = $${paramIndex}`);
            params.push(filters.is_remote);
            paramIndex++;
        }

        // Exclude blocked organizations for this user
        if (userId) {
            conditions.push(`
                NOT EXISTS (
                    SELECT 1 FROM blocked_organizations bo
                    WHERE bo.user_id = $1
                    AND LOWER(TRIM(COALESCE(v.company_name, ''))) = bo.company_name_normalized
                )
            `);
        }

        queryText += ' WHERE ' + conditions.join(' AND ');

        // Сортування
        if (userId && filters.sort_by_match) {
            queryText += ' ORDER BY uvs.match_score DESC NULLS LAST, v.scraped_at DESC';
        } else {
            queryText += ' ORDER BY v.scraped_at DESC';
        }

        // Ліміт
        if (filters.limit) {
            queryText += ` LIMIT ${parseInt(filters.limit)}`;
        }

        const result = await query(queryText, params);

        // Додати поле 'link' для backward compatibility
        return result.rows.map(row => ({
            ...row,
            link: row.source_url,
            company: row.company_name || row.company_full_name,
            location: row.city_name || row.location_text,
            status: row.application_status || 'gevonden'
        }));
    },

    /**
     * Отримати вакансію за ID
     */
    getVacatureById: async (id, userId = null) => {
        let queryText = `
      SELECT 
        v.*,
        v.source_url as link,
        co.name as country_name,
        co.code as country_code,
        ci.name as city_name,
        r.name as region_name,
        comp.name as company_full_name,
        comp.logo_url as company_logo,
        comp.website as company_website
    `;

        if (userId) {
            queryText += `,
        uvs.match_score,
        uvs.is_interesting,
        uvs.is_applied,
        uvs.is_saved,
        uvs.notes,
        uvs.motivation_letter,
        uvs.motivation_letter,
        uvs.application_status,
        uvs.match_details
      `;
        }

        queryText += `
      FROM vacancies v
      LEFT JOIN countries co ON v.country_id = co.id
      LEFT JOIN cities ci ON v.city_id = ci.id
      LEFT JOIN regions r ON v.region_id = r.id
      LEFT JOIN companies comp ON v.company_id = comp.id
    `;

        if (userId) {
            queryText += `
        LEFT JOIN user_vacancy_scores uvs ON v.id = uvs.vacancy_id AND uvs.user_id = $2
      `;
        }

        queryText += ' WHERE v.id = $1';

        const params = userId ? [id, userId] : [id];
        const result = await query(queryText, params);

        if (result.rows.length === 0) return null;

        const row = result.rows[0];
        return {
            ...row,
            link: row.source_url,
            company: row.company_name || row.company_full_name,
            location: row.city_name || row.location_text,
            status: row.application_status || 'gevonden'
        };
    },

    /**
     * Create or update a vacancy with enterprise-grade deduplication.
     * 
     * Identity priority chain:
     *   1. Source-native ID (e.g., LinkedIn job ID)
     *   2. Canonical URL hash
     *   3. Business dedup hash (source|title|company|city)
     * 
     * Business rule: A vacancy is duplicate when it has the same
     * source + normalized title + normalized company + normalized city.
     * 
     * On conflict (dedup_key), existing row is UPDATED with fresh data.
     * 
     * @param {Object} vacancyData - Raw vacancy data from scraper or API
     * @returns {Object} Created/updated vacancy row with metadata
     */
    createVacature: async (vacancyData) => {
        const mapped = mapLegacyVacancyFields(vacancyData);

        // Resolve location → country/city IDs
        let countryId = null;
        let cityId = null;

        if (mapped.country) {
            countryId = await findOrCreateCountry(mapped.country);
        }

        if (mapped.city && countryId) {
            cityId = await findOrCreateCity(mapped.city, countryId);
        }

        // Resolve company → company ID
        let companyId = null;
        if (mapped.company || mapped.company_name) {
            companyId = await findOrCreateCompany(mapped.company || mapped.company_name, countryId);
        }

        const {
            source,
            source_url,
            title,
            description = null,
            requirements = null,
            responsibilities = null,
            benefits = null,
            contract_type = null,
            job_type = null,
            experience_level = null,
            salary_min = null,
            salary_max = null,
            salary_currency = 'EUR',
            salary_period = null,
            salary_text = null,
            required_skills = null,
            preferred_skills = null,
            languages_required = null,
            posted_at = null,
            expires_at = null,
            is_remote = false,
            location_text = null,
            postcode = null
        } = mapped;

        // --- Dedup: Generate deterministic source_id (identity priority chain) ---
        const finalSourceId = generateSourceId(mapped);

        // --- Dedup: Compute normalized columns and dedup_key ---
        const companyName = mapped.company || mapped.company_name || '';
        const locationRaw = location_text || mapped.location || '';

        const titleNormalized = normalizeDedupField(title);
        const companyNormalized = normalizeDedupField(companyName);
        const cityNormalized = normalizeCity(locationRaw);
        const dedupKey = generateSafeDedupKey({
            source, title, company: companyName,
            location: locationRaw, source_url, link: mapped.link
        });

        // --- Classify vacancy into categories ---
        const categories = classifyVacancy(title, description);

        // --- Detect employment type ---
        const employmentType = detectEmploymentType(title, description);

        // --- Upsert: INSERT or UPDATE on dedup_key conflict ---
        try {
            const result = await query(
                `INSERT INTO vacancies 
         (source, source_id, source_url, title, company_id, company_name,
          country_id, city_id, location_text,
          description, requirements, responsibilities, benefits,
          contract_type, job_type, experience_level,
          salary_min, salary_max, salary_currency, salary_period, salary_text,
          required_skills, preferred_skills, languages_required,
          posted_at, expires_at, is_remote,
          title_normalized, company_normalized, city_normalized, dedup_key, categories, employment_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27,
                 $28, $29, $30, $31, $32, $33)
         ON CONFLICT (dedup_key) 
         DO UPDATE SET 
           title = EXCLUDED.title,
           source_url = EXCLUDED.source_url,
           source_id = EXCLUDED.source_id,
           description = COALESCE(NULLIF(EXCLUDED.description, ''), vacancies.description),
           company_id = COALESCE(EXCLUDED.company_id, vacancies.company_id),
           company_name = COALESCE(NULLIF(EXCLUDED.company_name, ''), vacancies.company_name),
           city_id = COALESCE(EXCLUDED.city_id, vacancies.city_id),
           location_text = COALESCE(NULLIF(EXCLUDED.location_text, ''), vacancies.location_text),
           title_normalized = EXCLUDED.title_normalized,
           company_normalized = EXCLUDED.company_normalized,
           city_normalized = EXCLUDED.city_normalized,
           categories = EXCLUDED.categories,
           employment_type = COALESCE(EXCLUDED.employment_type, vacancies.employment_type),
           updated_at = CURRENT_TIMESTAMP
         RETURNING *, (xmax = 0) AS was_inserted`,
                [
                    source, finalSourceId, source_url, title, companyId, companyName,
                    countryId, cityId, locationRaw,
                    description, requirements, responsibilities, benefits,
                    contract_type, job_type, experience_level,
                    salary_min, salary_max, salary_currency, salary_period, salary_text,
                    required_skills, preferred_skills, languages_required,
                    posted_at, expires_at, is_remote,
                    titleNormalized, companyNormalized, cityNormalized, dedupKey,
                    categories.length > 0 ? categories : null,
                    employmentType
                ]
            );

            const row = result.rows[0];
            return {
                ...row,
                link: row.source_url,
                postcode: postcode
            };
        } catch (error) {
            console.error('Error creating vacancy:', error);
            console.error('Vacancy data:', { source, source_id: finalSourceId, source_url, title, dedupKey });
            throw error;
        }
    },

    /**
     * Bulk create/update vacancies with geocoding and dedup telemetry.
     * 
     * Telemetry tracks: total, inserts, updates, errors, categorized.
     * 
     * @param {Array} vacancies - Array of raw vacancy objects
     * @returns {Array} Array of created/updated vacancy rows
     */
    createMultipleVacatures: async (vacancies) => {
        const results = [];
        const errors = [];
        const geocodingService = require('../services/geocodingService');

        // Telemetry counters
        let inserts = 0;
        let updates = 0;
        let categorized = 0;

        for (const vac of vacancies) {
            try {
                // Geocode location if we have postcode or city
                if (vac.postcode || vac.city || vac.location) {
                    try {
                        const coords = await geocodingService.geocode(
                            vac.postcode,
                            vac.city || vac.location,
                            vac.country || 'BE'
                        );

                        // Add geocoded coordinates to vacancy data
                        vac.latitude = coords.lat;
                        vac.longitude = coords.lng;
                    } catch (geoError) {
                        // Continue without geocoding - vacancy will still be saved
                    }
                }

                const created = await dbHelpers.createVacature(vac);
                results.push(created);

                // Track telemetry
                if (created.was_inserted) {
                    inserts++;
                } else {
                    updates++;
                }
                if (created.categories && created.categories.length > 0) {
                    categorized++;
                }
            } catch (error) {
                errors.push({ vacancy: vac.title, error: error.message });
            }
        }

        // Log dedup telemetry
        console.log(`[Dedup] Total: ${vacancies.length} | Inserts: ${inserts} | Updates: ${updates} | Errors: ${errors.length} | Categorized: ${categorized}/${results.length}`);

        if (errors.length > 0) {
            console.warn(`[Dedup] Failed entries:`, errors.slice(0, 5).map(e => `${e.vacancy}: ${e.error}`).join('; '));
        }

        return results;
    },

    /**
     * Оновити статус вакансії (backward compatibility)
     */
    updateVacatureStatus: async (id, status) => {
        // В новій схемі статус зберігається в user_vacancy_scores
        // Для backward compatibility просто повертаємо вакансію
        return await dbHelpers.getVacatureById(id);
    },

    /**
     * Отримати вакансії за статусом (backward compatibility)
     */
    getVacaturesByStatus: async (status, userId = 1) => {
        return await dbHelpers.getAllVacatures({ status }, userId);
    },

    /**
     * Пошук вакансій за текстом
     */
    searchVacatures: async (searchText, filters = {}, userId = null) => {
        let queryText = `
      SELECT 
        v.*,
        v.source_url as link,
        co.name as country_name,
        ci.name as city_name,
        comp.name as company_full_name,
        ts_rank(to_tsvector('english', v.title || ' ' || COALESCE(v.description, '')), plainto_tsquery('english', $1)) as rank
    `;

        if (userId) {
            queryText += `, uvs.match_score, uvs.is_saved, uvs.is_applied`;
        }

        queryText += `
      FROM vacancies v
      LEFT JOIN countries co ON v.country_id = co.id
      LEFT JOIN cities ci ON v.city_id = ci.id
      LEFT JOIN companies comp ON v.company_id = comp.id
    `;

        if (userId) {
            queryText += `
        LEFT JOIN user_vacancy_scores uvs ON v.id = uvs.vacancy_id AND uvs.user_id = $2
      `;
        }

        queryText += `
      WHERE v.is_active = true
        AND (
          to_tsvector('english', v.title || ' ' || COALESCE(v.description, '')) @@ plainto_tsquery('english', $1)
          OR v.title ILIKE $${userId ? 3 : 2}
        )
      ORDER BY rank DESC, v.scraped_at DESC
      LIMIT 100
    `;

        const params = userId
            ? [searchText, userId, `%${searchText}%`]
            : [searchText, `%${searchText}%`];

        const result = await query(queryText, params);
        return result.rows.map(row => ({
            ...row,
            link: row.source_url,
            company: row.company_name || row.company_full_name,
            location: row.city_name || row.location_text
        }));
    },

    // ============================================
    // USER VACANCY SCORES - Персональні взаємодії
    // ============================================

    /**
     * Отримати score користувача для вакансії
     */
    getUserVacancyScore: async (userId, vacancyId) => {
        const result = await query(
            'SELECT * FROM user_vacancy_scores WHERE user_id = $1 AND vacancy_id = $2',
            [userId, vacancyId]
        );
        return result.rows[0];
    },

    /**
     * Встановити або оновити score
     */
    setUserVacancyScore: async (userId, vacancyId, scoreData) => {
        const {
            match_score = null,
            is_interesting = false,
            is_applied = false,
            is_saved = false,
            is_hidden = false,
            notes = null,
            motivation_letter = null,
            application_status = null,
            match_details = null
        } = scoreData;

        const result = await query(
            `INSERT INTO user_vacancy_scores 
       (user_id, vacancy_id, match_score, is_interesting, is_applied, is_saved, is_hidden, notes, motivation_letter, application_status, match_details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (user_id, vacancy_id) 
       DO UPDATE SET 
         match_score = COALESCE(EXCLUDED.match_score, user_vacancy_scores.match_score),
         match_details = COALESCE(EXCLUDED.match_details, user_vacancy_scores.match_details),
         is_interesting = EXCLUDED.is_interesting,
         is_applied = EXCLUDED.is_applied,
         is_saved = EXCLUDED.is_saved,
         is_hidden = EXCLUDED.is_hidden,
         notes = COALESCE(EXCLUDED.notes, user_vacancy_scores.notes),
         motivation_letter = COALESCE(EXCLUDED.motivation_letter, user_vacancy_scores.motivation_letter),
         application_status = COALESCE(EXCLUDED.application_status, user_vacancy_scores.application_status),
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
            [userId, vacancyId, match_score, is_interesting, is_applied, is_saved, is_hidden, notes, motivation_letter, application_status, match_details]
        );
        return result.rows[0];
    },

    /**
     * Позначити вакансію як цікаву
     */
    markVacancyAsInteresting: async (userId, vacancyId, isInteresting = true) => {
        return await dbHelpers.setUserVacancyScore(userId, vacancyId, { is_interesting: isInteresting });
    },

    /**
     * Позначити вакансію як applied (Backward compatibility)
     */
    markVacancyAsApplied: async (userId, vacancyId, motivationLetter = null) => {
        return await dbHelpers.setUserVacancyScore(userId, vacancyId, {
            is_applied: true,
            applied_at: new Date(),
            motivation_letter: motivationLetter,
            application_status: 'sent'
        });
    },

    /**
     * Зберегти вакансію
     */
    saveVacancy: async (userId, vacancyId) => {
        return await dbHelpers.setUserVacancyScore(userId, vacancyId, { is_saved: true });
    },

    // ============================================
    // AUTO APPLY QUEUE
    // ============================================

    /**
     * Додати вакансії в чергу автоподачі
     */
    /**
     * Get full auto apply queue for a user
     */
    getAutoApplyQueue: async (userId) => {
        const result = await query(
            `SELECT 
                q.id,
                q.status,
                q.attempts,
                q.created_at,
                q.updated_at,
                v.title as job_title,
                v.company_name as company,
                v.source_url as link
             FROM auto_apply_queue q
             JOIN vacancies v ON q.vacancy_id = v.id
             WHERE q.user_id = $1
             ORDER BY q.created_at DESC`,
            [userId]
        );
        return result.rows;
    },

    addToAutoApplyQueue: async (userId, vacancyIds) => {
        if (!vacancyIds || vacancyIds.length === 0) return [];

        const results = [];
        const errors = [];

        for (const vacId of vacancyIds) {
            try {
                // Отримати URL вакансії
                const vac = await dbHelpers.getVacatureById(vacId);
                if (!vac || !vac.source_url) {
                    console.warn(`Vacancy ${vacId} not found or has no URL`);
                    continue;
                }

                const result = await query(
                    `INSERT INTO auto_apply_queue 
           (user_id, vacancy_id, job_url, status, priority, attempts, max_attempts)
           VALUES ($1, $2, $3, 'pending', 0, 0, 3)
           ON CONFLICT (user_id, vacancy_id) 
           DO UPDATE SET 
             status = CASE 
               WHEN auto_apply_queue.status IN ('failed', 'blocked') THEN 'pending' 
               ELSE auto_apply_queue.status 
             END,
             attempts = 0,
             error_message = NULL,
             updated_at = CURRENT_TIMESTAMP
           RETURNING id, vacancy_id, status`,
                    [userId, vacId, vac.source_url]
                );
                results.push(result.rows[0]);
            } catch (error) {
                console.error(`Error adding vacancy ${vacId} to queue:`, error);
                errors.push({ id: vacId, error: error.message });
            }
        }
        return results;
    },

    /**
     * Отримати статуси автоподачі для списку вакансій (або всіх)
     */
    getAutoApplyStatuses: async (userId) => {
        const result = await query(
            `SELECT vacancy_id, status FROM auto_apply_queue WHERE user_id = $1`,
            [userId]
        );

        // Convert array to object { vacancy_id: status }
        const statusMap = {};
        result.rows.forEach(row => {
            statusMap[row.vacancy_id] = row.status;
        });

        return statusMap;
    },

    /**
     * Отримати збережені вакансії користувача
     */
    getSavedVacancies: async (userId) => {
        return await dbHelpers.getAllVacatures({ status: null }, userId);
    },

    // ============================================
    // ВЗАЄМОДІЇ (для аналітики)
    // ============================================

    /**
     * Записати взаємодію користувача з вакансією
     */
    logInteraction: async (userId, vacancyId, interactionType, metadata = {}) => {
        const { device_type = null, referrer = null } = metadata;

        await query(
            `INSERT INTO user_vacancy_interactions (user_id, vacancy_id, interaction_type, device_type, referrer)
       VALUES ($1, $2, $3, $4, $5)`,
            [userId, vacancyId, interactionType, device_type, referrer]
        );
    },

    // ============================================
    // ЛОКАЦІЇ
    // ============================================

    /**
     * Отримати всі країни
     */
    getAllCountries: async () => {
        const result = await query('SELECT * FROM countries WHERE is_active = true ORDER BY name');
        return result.rows;
    },

    /**
     * Отримати міста країни
     */
    getCitiesByCountry: async (countryId) => {
        const result = await query(
            'SELECT * FROM cities WHERE country_id = $1 AND is_active = true ORDER BY name',
            [countryId]
        );
        return result.rows;
    },

    /**
     * Отримати регіони міста
     */
    getRegionsByCity: async (cityId) => {
        const result = await query(
            'SELECT * FROM regions WHERE city_id = $1 AND is_active = true ORDER BY name',
            [cityId]
        );
        return result.rows;
    },

    // ============================================
    // BACKWARD COMPATIBILITY
    // ============================================

    updateVacatureMotivation: async (userId, id, motivation) => {
        if (!userId) throw new Error('userId is required for updateVacatureMotivation');
        // В новій схемі це зберігається в user_vacancy_scores
        await dbHelpers.setUserVacancyScore(userId, id, { notes: motivation });
        return await dbHelpers.getVacatureById(id, userId);
    },

    updateMultipleVacatureMotivations: async (userId, updates) => {
        if (!userId) throw new Error('userId is required for updateMultipleVacatureMotivations');
        const results = [];
        for (const update of updates) {
            await dbHelpers.setUserVacancyScore(userId, update.id, { notes: update.motivation });
            const vac = await dbHelpers.getVacatureById(update.id, userId);
            if (vac) results.push(vac);
        }
        return results;
    },

    // ============================================
    // GEOCODING CACHE
    // ============================================

    /**
     * Get cached coordinates for a postcode
     */
    getCachedCoordinates: async (postcode, city = null, country = 'BE') => {
        const params = [postcode, country];
        let whereClause = 'postcode = $1 AND country = $2';

        if (city) {
            whereClause += ' AND city = $3';
            params.push(city);
        }

        const result = await query(
            `SELECT latitude, longitude, display_name, source 
             FROM geocoding_cache 
             WHERE ${whereClause}
             ORDER BY updated_at DESC
             LIMIT 1`,
            params
        );

        if (result.rows.length > 0) {
            const row = result.rows[0];
            return {
                lat: parseFloat(row.latitude),
                lng: parseFloat(row.longitude),
                name: row.display_name,
                source: row.source
            };
        }

        return null;
    },

    /**
     * Cache coordinates in database
     */
    cacheCoordinates: async (postcode, city, country, latitude, longitude, displayName, source = 'nominatim') => {
        try {
            await query(
                `INSERT INTO geocoding_cache (postcode, city, country, latitude, longitude, display_name, source)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (postcode, city, country)
                 DO UPDATE SET
                    latitude = EXCLUDED.latitude,
                    longitude = EXCLUDED.longitude,
                    display_name = EXCLUDED.display_name,
                    source = EXCLUDED.source,
                    updated_at = CURRENT_TIMESTAMP`,
                [postcode, city, country, latitude, longitude, displayName, source]
            );
            console.log(`✅ Cached coordinates for ${postcode}, ${city}`);
        } catch (error) {
            console.error('Error caching coordinates:', error);
        }
    },

    /**
     * Clear old geocoding cache entries (older than 30 days)
     */
    clearOldGeocodingCache: async (daysOld = 30) => {
        const result = await query(
            `DELETE FROM geocoding_cache 
             WHERE updated_at < NOW() - INTERVAL '${daysOld} days'
             RETURNING id`,
            []
        );
        console.log(`🧹 Cleared ${result.rowCount} old geocoding cache entries`);
        return result.rowCount;
    },

    /**
     * Get vacancy statistics by source (for import tracking)
     */
    getVacancyStatsBySource: async () => {
        const result = await query(
            `SELECT
                source,
                COUNT(*) as total_count,
                COUNT(*) FILTER (WHERE is_active = true) as active_count,
                MIN(scraped_at) as oldest_scraped,
                MAX(scraped_at) as newest_scraped
             FROM vacancies
             GROUP BY source
             ORDER BY total_count DESC`
        );
        return result.rows;
    },

    // ============================================
    // BLOCKED ORGANIZATIONS
    // ============================================

    getBlockedOrganizations: async (userId) => {
        const result = await query(
            `SELECT id, company_name, company_name_normalized, reason, created_at
             FROM blocked_organizations
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [userId]
        );
        return result.rows;
    },

    getBlockedCompanyNames: async (userId) => {
        const result = await query(
            `SELECT company_name_normalized FROM blocked_organizations WHERE user_id = $1`,
            [userId]
        );
        return result.rows.map(r => r.company_name_normalized);
    },

    blockOrganization: async (userId, companyName, reason = null) => {
        const normalized = companyName.toLowerCase().trim();
        const result = await query(
            `INSERT INTO blocked_organizations (user_id, company_name, company_name_normalized, reason)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, company_name_normalized) DO NOTHING
             RETURNING *`,
            [userId, companyName.trim(), normalized, reason]
        );
        return result.rows[0] || null;
    },

    unblockOrganization: async (userId, blockedOrgId) => {
        const result = await query(
            `DELETE FROM blocked_organizations
             WHERE id = $1 AND user_id = $2
             RETURNING *`,
            [blockedOrgId, userId]
        );
        return result.rows[0] || null;
    },

    isOrganizationBlocked: async (userId, companyName) => {
        if (!companyName) return false;
        const normalized = companyName.toLowerCase().trim();
        const result = await query(
            `SELECT id FROM blocked_organizations
             WHERE user_id = $1 AND company_name_normalized = $2
             LIMIT 1`,
            [userId, normalized]
        );
        return result.rows.length > 0;
    }
};

module.exports = dbHelpers;
