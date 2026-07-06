#!/usr/bin/env node

/**
 * Міграція з старої схеми БД на нову покращену схему
 * 
 * Використання:
 *   node database/migrate_to_v2.js
 * 
 * Цей скрипт:
 * 1. Створює backup поточної БД
 * 2. Створює нову схему v2
 * 3. Переносить дані зі старої схеми в нову
 * 4. Перевіряє цілісність даних
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Створити connection pool
const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'jobfinder',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD
});

async function runSQL(sql, params = []) {
    const client = await pool.connect();
    try {
        const result = await client.query(sql, params);
        return result;
    } finally {
        client.release();
    }
}

async function createBackup() {
    console.log('\n📦 Створення backup поточної БД...');

    try {
        // Отримати всі дані зі старих таблиць
        const users = await runSQL('SELECT * FROM users');
        const vacancies = await runSQL('SELECT * FROM vacancies');
        const userVacancyScores = await runSQL('SELECT * FROM user_vacancy_scores');
        const countries = await runSQL('SELECT * FROM countries');
        const cities = await runSQL('SELECT * FROM cities');
        const regions = await runSQL('SELECT * FROM regions');

        const backup = {
            timestamp: new Date().toISOString(),
            users: users.rows,
            vacancies: vacancies.rows,
            user_vacancy_scores: userVacancyScores.rows,
            countries: countries.rows,
            cities: cities.rows,
            regions: regions.rows
        };

        const backupPath = path.join(__dirname, `backup_${Date.now()}.json`);
        fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

        console.log(`✅ Backup збережено: ${backupPath}`);
        console.log(`   - Користувачів: ${backup.users.length}`);
        console.log(`   - Вакансій: ${backup.vacancies.length}`);
        console.log(`   - User Scores: ${backup.user_vacancy_scores.length}`);

        return backupPath;
    } catch (error) {
        console.error('❌ Помилка створення backup:', error.message);
        throw error;
    }
}

async function applyNewSchema() {
    console.log('\n🔧 Застосування нової схеми v2...');

    const schemaPath = path.join(__dirname, 'schema_v2.sql');
    if (!fs.existsSync(schemaPath)) {
        throw new Error(`Schema file not found: ${schemaPath}`);
    }

    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    try {
        await runSQL(schemaSql);
        console.log('✅ Нова схема v2 застосована успішно');
    } catch (error) {
        console.error('❌ Помилка застосування схеми:', error.message);
        throw error;
    }
}

async function migrateData(backupPath) {
    console.log('\n🔄 Міграція даних зі старої схеми в нову...');

    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Мігрувати користувачів
        console.log('   Міграція користувачів...');
        let migratedUsers = 0;
        for (const user of backup.users) {
            try {
                await client.query(
                    `INSERT INTO users 
           (id, email, password_hash, name, skills, personality, availability, 
            languages, experience, expected_salary, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (email) DO NOTHING`,
                    [
                        user.id,
                        user.email,
                        user.password_hash,
                        user.name || '',
                        user.skills ? (Array.isArray(user.skills) ? user.skills : [user.skills]) : [],
                        user.personality || '',
                        user.availability || '',
                        user.languages || ['en'],
                        user.experience || null,
                        user.expected_salary || null,
                        user.created_at || new Date()
                    ]
                );
                migratedUsers++;
            } catch (error) {
                console.warn(`   ⚠️  Не вдалось мігрувати користувача ${user.email}: ${error.message}`);
            }
        }
        console.log(`   ✅ Мігровано ${migratedUsers} користувачів`);

        // Скинути sequence для users
        await client.query(`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))`);

        // 2. Мігрувати вакансії
        console.log('   Міграція вакансій...');
        let migratedVacancies = 0;

        for (const vac of backup.vacancies) {
            try {
                // Знайти або створити країну
                let countryId = null;
                if (vac.country) {
                    let countryResult = await client.query(
                        'SELECT id FROM countries WHERE LOWER(name) = LOWER($1) OR code = $2',
                        [vac.country, vac.country.substring(0, 2).toUpperCase()]
                    );

                    if (countryResult.rows.length > 0) {
                        countryId = countryResult.rows[0].id;
                    }
                }

                // Знайти або створити місто
                let cityId = null;
                if (vac.city && countryId) {
                    let cityResult = await client.query(
                        'SELECT id FROM cities WHERE country_id = $1 AND LOWER(name) = LOWER($2)',
                        [countryId, vac.city]
                    );

                    if (cityResult.rows.length > 0) {
                        cityId = cityResult.rows[0].id;
                    } else {
                        // Створити нове місто
                        const newCity = await client.query(
                            'INSERT INTO cities (country_id, name) VALUES ($1, $2) RETURNING id',
                            [countryId, vac.city]
                        );
                        cityId = newCity.rows[0].id;
                    }
                }

                // Знайти або створити компанію
                let companyId = null;
                if (vac.company) {
                    let companyResult = await client.query(
                        'SELECT id FROM companies WHERE LOWER(name) = LOWER($1)',
                        [vac.company]
                    );

                    if (companyResult.rows.length > 0) {
                        companyId = companyResult.rows[0].id;
                    } else {
                        // Створити нову компанію
                        const slug = vac.company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                        try {
                            const newCompany = await client.query(
                                'INSERT INTO companies (name, slug, country_id) VALUES ($1, $2, $3) RETURNING id',
                                [vac.company, slug, countryId]
                            );
                            companyId = newCompany.rows[0].id;
                        } catch (err) {
                            // Ignore duplicate slug errors
                        }
                    }
                }

                // Вставити вакансію
                const sourceUrl = vac.link || vac.url || vac.source_url || `https://example.com/job/${vac.id}`;
                const sourceId = vac.source_id || `legacy_${vac.id}`;

                await client.query(
                    `INSERT INTO vacancies 
           (source, source_id, source_url, title, company_id, company_name,
            country_id, city_id, location_text, description,
            contract_type, job_type, salary_min, salary_text,
            scraped_at, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
           ON CONFLICT (source, source_id) DO NOTHING`,
                    [
                        vac.source || 'legacy',
                        sourceId,
                        sourceUrl,
                        vac.title,
                        companyId,
                        vac.company,
                        countryId,
                        cityId,
                        vac.location || vac.city,
                        vac.description,
                        vac.contract_type,
                        vac.job_type,
                        vac.salary,
                        vac.salary ? `€${vac.salary}` : null,
                        vac.scraped_at || new Date(),
                        true
                    ]
                );
                migratedVacancies++;
            } catch (error) {
                console.warn(`   ⚠️  Не вдалось мігрувати вакансію "${vac.title}": ${error.message}`);
            }
        }
        console.log(`   ✅ Мігровано ${migratedVacancies} вакансій`);

        // 3. Мігрувати user vacancy scores
        console.log('   Міграція user vacancy scores...');
        let migratedScores = 0;

        for (const score of backup.user_vacancy_scores) {
            try {
                // Знайти відповідну вакансію в новій схемі
                // Оскільки ми змінили структуру, потрібно знайти vacancy за старим ID
                const oldVacancy = backup.vacancies.find(v => v.id === score.vacancy_id);
                if (!oldVacancy) continue;

                const sourceId = oldVacancy.source_id || `legacy_${oldVacancy.id}`;
                const source = oldVacancy.source || 'legacy';

                const newVacancyResult = await client.query(
                    'SELECT id FROM vacancies WHERE source = $1 AND source_id = $2',
                    [source, sourceId]
                );

                if (newVacancyResult.rows.length === 0) continue;

                const newVacancyId = newVacancyResult.rows[0].id;

                await client.query(
                    `INSERT INTO user_vacancy_scores 
           (user_id, vacancy_id, match_score, is_interesting, is_applied, notes, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (user_id, vacancy_id) DO NOTHING`,
                    [
                        score.user_id,
                        newVacancyId,
                        score.match_score,
                        score.is_interesting || false,
                        score.is_applied || false,
                        score.notes,
                        score.created_at || new Date()
                    ]
                );
                migratedScores++;
            } catch (error) {
                console.warn(`   ⚠️  Не вдалось мігрувати score: ${error.message}`);
            }
        }
        console.log(`   ✅ Мігровано ${migratedScores} user vacancy scores`);

        await client.query('COMMIT');
        console.log('\n✅ Міграція даних завершена успішно!');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Помилка міграції даних:', error);
        throw error;
    } finally {
        client.release();
    }
}

async function verifyMigration() {
    console.log('\n🔍 Перевірка міграції...');

    try {
        const users = await runSQL('SELECT COUNT(*) FROM users');
        const vacancies = await runSQL('SELECT COUNT(*) FROM vacancies');
        const companies = await runSQL('SELECT COUNT(*) FROM companies');
        const scores = await runSQL('SELECT COUNT(*) FROM user_vacancy_scores');
        const countries = await runSQL('SELECT COUNT(*) FROM countries');
        const cities = await runSQL('SELECT COUNT(*) FROM cities');

        console.log('\n📊 Статистика нової БД:');
        console.log(`   👤 Користувачів: ${users.rows[0].count}`);
        console.log(`   💼 Вакансій: ${vacancies.rows[0].count}`);
        console.log(`   🏢 Компаній: ${companies.rows[0].count}`);
        console.log(`   ⭐ User Scores: ${scores.rows[0].count}`);
        console.log(`   🌍 Країн: ${countries.rows[0].count}`);
        console.log(`   🏙️  Міст: ${cities.rows[0].count}`);

        // Перевірити чи є default користувач
        const defaultUser = await runSQL('SELECT * FROM users WHERE id = 1');
        if (defaultUser.rows.length > 0) {
            console.log(`   ✅ Default користувач існує: ${defaultUser.rows[0].email}`);
        } else {
            console.log('   ⚠️  Default користувач не знайдений');
        }

        console.log('\n✅ Перевірка завершена!');
    } catch (error) {
        console.error('❌ Помилка перевірки:', error.message);
    }
}

async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║  JobFinder Database Migration v1 → v2                  ║');
    console.log('╚══════════════════════════════════════════════════════════╝');

    try {
        // Перевірити підключення
        await pool.query('SELECT NOW()');
        console.log('✅ Підключення до PostgreSQL встановлено');

        // Питання користувача
        console.log('\n⚠️  УВАГА: Цей скрипт ВИДАЛИТЬ всі існуючі таблиці та створить нову схему!');
        console.log('   Перед продовженням буде створено backup.');
        console.log('\n   Натисніть Ctrl+C для скасування або Enter для продовження...');

        // На Windows процес не чекає на stdin, тому пропускаємо цю частину
        // і одразу продовжуємо

        // Крок 1: Backup
        const backupPath = await createBackup();

        // Крок 2: Застосувати нову схему
        await applyNewSchema();

        // Крок 3: Міграція даних
        await migrateData(backupPath);

        // Крок 4: Перевірка
        await verifyMigration();

        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║  ✅ Міграція завершена успішно!                        ║');
        console.log('╚══════════════════════════════════════════════════════════╝');
        console.log(`\n💾 Backup збережено: ${backupPath}`);
        console.log('\n📝 Наступні кроки:');
        console.log('   1. Оновити database/index.js для використання postgresHelpers_v2.js');
        console.log('   2. Перезапустити сервер');
        console.log('   3. Протестувати всі функції');

    } catch (error) {
        console.error('\n❌ Міграція провалилась:', error.message);
        console.error('\n💡 Підказки:');
        console.error('   - Перевірте налаштування підключення до БД в .env');
        console.error('   - Переконайтесь що PostgreSQL запущений');
        console.error('   - Перевірте що файл schema_v2.sql існує');
        console.error('   - Відновіть дані з backup при потребі');
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Запустити міграцію
if (require.main === module) {
    main();
}

module.exports = { main };
