// PostgreSQL Database Helper Functions
// Simplified schema with global vacancies
const { query, getClient } = require('./postgres');

/**
 * Map legacy field names to new simplified schema
 * Перетворює старі назви полів на нові для сумісності
 */
const mapLegacyVacancyFields = (vacancyData) => {
    const mapped = { ...vacancyData };

    // Map 'source' or 'source_site' to 'source'
    if (mapped.source_site && !mapped.source) {
        mapped.source = mapped.source_site;
        delete mapped.source_site;
    }

    // Map 'location' might contain city info
    if (!mapped.city && mapped.location) {
        mapped.city = mapped.location;
    }

    return mapped;
};

const dbHelpers = {
    // ============================================
    // USERS
    // ============================================

    /**
     * Get user by ID
     */
    getUserById: async (id) => {
        const result = await query('SELECT * FROM users WHERE id = $1', [id]);
        return result.rows[0];
    },

    /**
     * Create new user
     */
    createUser: async (userData) => {
        const {
            email,
            password_hash,
            name = '',
            skills = '',
            personality = '',
            availability = ''
        } = userData;

        const result = await query(
            `INSERT INTO users (email, password_hash, name, skills, personality, availability)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [email, password_hash, name, skills, personality, availability]
        );
        return result.rows[0];
    },

    /**
     * Update user
     */
    updateUser: async (id, userData) => {
        const {
            name,
            skills,
            personality,
            availability
        } = userData;

        const result = await query(
            `UPDATE users 
             SET name = $1, skills = $2, personality = $3, availability = $4
             WHERE id = $5
             RETURNING *`,
            [name, skills, personality, availability, id]
        );
        return result.rows[0];
    },

    // ============================================
    // VACANCIES (GLOBAL)
    // ============================================

    /**
     * Get all vacatures with optional filters
     */
    getAllVacatures: async (filters = {}) => {
        let queryText = 'SELECT * FROM vacancies';
        const params = [];
        const conditions = [];

        if (filters.status) {
            conditions.push(`status = $${params.length + 1}`);
            params.push(filters.status);
        }

        if (filters.country) {
            conditions.push(`country = $${params.length + 1}`);
            params.push(filters.country);
        }

        if (filters.source) {
            conditions.push(`source = $${params.length + 1}`);
            params.push(filters.source);
        }

        if (conditions.length > 0) {
            queryText += ' WHERE ' + conditions.join(' AND ');
        }

        queryText += ' ORDER BY scraped_at DESC';

        const result = await query(queryText, params);
        return result.rows;
    },

    /**
     * Get vacature by ID
     */
    getVacatureById: async (id) => {
        const result = await query('SELECT * FROM vacancies WHERE id = $1', [id]);
        return result.rows[0];
    },

    /**
     * Create a new vacature
     */
    createVacature: async (vacancyData) => {
        const mapped = mapLegacyVacancyFields(vacancyData);

        const {
            title,
            company,
            source,
            country,
            city,
            region,
            postcode,
            description,
            contract_type,
            job_type,
            salary,
            link,
            status = 'gevonden'
        } = mapped;

        const result = await query(
            `INSERT INTO vacancies 
             (title, company, source, country, city, region, postcode, description, 
              contract_type, job_type, salary, link, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             RETURNING *`,
            [title, company, source, country, city, region, postcode, description,
                contract_type, job_type, salary, link, status]
        );
        return result.rows[0];
    },

    /**
     * Create multiple vacatures (bulk insert)
     */
    createMultipleVacatures: async (vacancies) => {
        const client = await getClient();
        try {
            await client.query('BEGIN');
            const results = [];

            for (const vac of vacancies) {
                const mapped = mapLegacyVacancyFields(vac);

                const result = await client.query(
                    `INSERT INTO vacancies 
                     (title, company, source, country, city, region, postcode, description,
                      contract_type, job_type, salary, link, status)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                     RETURNING *`,
                    [
                        mapped.title, mapped.company, mapped.source, mapped.country,
                        mapped.city, mapped.region, mapped.postcode, mapped.description,
                        mapped.contract_type, mapped.job_type, mapped.salary,
                        mapped.link, mapped.status || 'gevonden'
                    ]
                );
                results.push(result.rows[0]);
            }

            await client.query('COMMIT');
            return results;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update vacature status
     */
    updateVacatureStatus: async (id, status) => {
        const result = await query(
            'UPDATE vacancies SET status = $1 WHERE id = $2 RETURNING *',
            [status, id]
        );
        return result.rows[0];
    },

    /**
     * Get vacatures by status
     */
    getVacaturesByStatus: async (status) => {
        const result = await query(
            'SELECT * FROM vacancies WHERE status = $1 ORDER BY scraped_at DESC',
            [status]
        );
        return result.rows;
    },

    /**
     * Update vacature motivation (backward compatibility)
     */
    updateVacatureMotivation: async (id, motivation) => {
        // In new schema, this could be stored in user_vacancy_scores.notes
        // For now, just return the vacancy
        return await dbHelpers.getVacatureById(id);
    },

    /**
     * Update multiple vacature motivations
     */
    updateMultipleVacatureMotivations: async (updates) => {
        // Backward compatibility - return vacancies
        const results = [];
        for (const update of updates) {
            const vac = await dbHelpers.getVacatureById(update.id);
            if (vac) results.push(vac);
        }
        return results;
    },

    // ============================================
    // PROFILE (Simplified - uses default user ID 1)
    // ============================================

    getProfile: async () => {
        // Get or create default user profile
        let user = await query('SELECT * FROM users WHERE id = 1');

        if (user.rows.length === 0) {
            // Create default user if not exists
            user = await query(
                `INSERT INTO users (id, email, password_hash, name, skills, personality, availability)
                 VALUES (1, 'default@jobfinder.local', 'no_password', '', '', '', 'vrijdag, zaterdag, zondag (8:00–19:00)')
                 RETURNING *`
            );
        }

        return user.rows[0];
    },

    updateProfile: async (profileData) => {
        const { name, skills, personality, availability } = profileData;

        const result = await query(
            `UPDATE users 
             SET name = $1, skills = $2, personality = $3, availability = $4
             WHERE id = 1
             RETURNING *`,
            [name || '', skills || '', personality || '', availability || '']
        );

        return result.rows[0];
    },

    // ============================================
    // USER VACANCY SCORES (for future use)
    // ============================================

    /**
     * Get user's interaction with a vacancy
     */
    getUserVacancyScore: async (userId, vacancyId) => {
        const result = await query(
            'SELECT * FROM user_vacancy_scores WHERE user_id = $1 AND vacancy_id = $2',
            [userId, vacancyId]
        );
        return result.rows[0];
    },

    /**
     * Create or update user vacancy score
     */
    setUserVacancyScore: async (userId, vacancyId, scoreData) => {
        const {
            match_score,
            is_interesting,
            is_applied,
            notes
        } = scoreData;

        const result = await query(
            `INSERT INTO user_vacancy_scores 
             (user_id, vacancy_id, match_score, is_interesting, is_applied, notes)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (user_id, vacancy_id) 
             DO UPDATE SET 
               match_score = EXCLUDED.match_score,
               is_interesting = EXCLUDED.is_interesting,
               is_applied = EXCLUDED.is_applied,
               notes = EXCLUDED.notes
             RETURNING *`,
            [userId, vacancyId, match_score, is_interesting, is_applied, notes]
        );
        return result.rows[0];
    }
};

module.exports = dbHelpers;
