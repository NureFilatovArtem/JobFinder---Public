/**
 * Match Score Calculator
 * Calculates how well a vacancy matches a user's profile
 * Uses weighted scoring based on multiple factors
 */

/**
 * Calculate match score between user profile and vacancy
 * @param {Object} profile - User profile with skills, experience, languages, etc.
 * @param {Object} vacancy - Vacancy object with requirements
 * @returns {Object} - { score: number (0-100), breakdown: object }
 */
export const calculateMatchScore = (profile, vacancy) => {
    if (!profile || !vacancy) {
        return { score: 0, breakdown: {} };
    }

    const weights = {
        skills: 0.30,      // 30%
        experience: 0.20,  // 20%
        languages: 0.15,   // 15%
        location: 0.15,    // 15%
        salary: 0.10,      // 10%
        jobType: 0.10      // 10%
    };

    const breakdown = {
        skills: calculateSkillsMatch(profile.skills, vacancy.required_skills || vacancy.description),
        experience: calculateExperienceMatch(profile.experience_years, vacancy.experience_required),
        languages: calculateLanguagesMatch(profile.languages, vacancy.required_languages || vacancy.description),
        location: calculateLocationMatch(profile.preferred_locations, vacancy.location || vacancy.city),
        salary: calculateSalaryMatch(profile.expected_salary, vacancy.salary_min, vacancy.salary_max),
        jobType: calculateJobTypeMatch(profile.job_type_preferences, vacancy.contract_type || vacancy.job_type)
    };

    // Calculate weighted total score
    const score = Math.round(
        breakdown.skills * weights.skills +
        breakdown.experience * weights.experience +
        breakdown.languages * weights.languages +
        breakdown.location * weights.location +
        breakdown.salary * weights.salary +
        breakdown.jobType * weights.jobType
    );

    return {
        score: Math.min(Math.max(score, 0), 100),
        breakdown
    };
};

/**
 * Calculate skills match percentage
 */
function calculateSkillsMatch(userSkills, vacancySkills) {
    if (!userSkills || userSkills.length === 0) return 0;
    if (!vacancySkills) return 50; // Neutral score if vacancy has no skills listed

    const userSkillsArray = Array.isArray(userSkills) ? userSkills : userSkills.split(',').map(s => s.trim());
    const vacancyText = Array.isArray(vacancySkills) ? vacancySkills.join(' ') : vacancySkills;

    // Normalize text for comparison
    const normalizedVacancy = vacancyText.toLowerCase();

    // Count matching skills
    let matchCount = 0;
    userSkillsArray.forEach(skill => {
        if (normalizedVacancy.includes(skill.toLowerCase())) {
            matchCount++;
        }
    });

    // Calculate percentage
    const matchPercentage = (matchCount / userSkillsArray.length) * 100;

    // If more than 50% match, give bonus up to 100%
    if (matchPercentage > 50) {
        return Math.min(50 + matchPercentage, 100);
    }

    return Math.round(matchPercentage);
}

/**
 * Calculate experience match percentage
 */
function calculateExperienceMatch(userExperience, requiredExperience) {
    if (!userExperience && userExperience !== 0) return 50; // Neutral if user hasn't specified
    if (!requiredExperience) return 75; // Good score if no requirement specified

    // Extract years from requirement text (e.g., "3-5 years", "2+ years")
    const yearsMatch = requiredExperience.toString().match(/(\d+)[\s-+]*(?:to|-)?\s*(\d+)?/);

    if (!yearsMatch) return 50; // Can't parse requirement

    const minRequired = parseInt(yearsMatch[1]);
    const maxRequired = yearsMatch[2] ? parseInt(yearsMatch[2]) : minRequired + 2;

    if (userExperience >= minRequired && userExperience <= maxRequired + 2) {
        return 100; // Perfect match
    } else if (userExperience >= minRequired - 1) {
        return 80; // Close match
    } else if (userExperience >= minRequired - 2) {
        return 60; // Acceptable
    } else {
        // Calculate percentage based on gap
        const gap = minRequired - userExperience;
        return Math.max(0, 50 - (gap * 10));
    }
}

/**
 * Calculate languages match percentage
 */
function calculateLanguagesMatch(userLanguages, requiredLanguages) {
    if (!userLanguages || userLanguages.length === 0) return 30; // Low score if user hasn't specified
    if (!requiredLanguages) return 75; // Good score if no requirement

    const userLangsArray = Array.isArray(userLanguages) ? userLanguages : userLanguages.split(',').map(l => l.trim());
    const requiredText = Array.isArray(requiredLanguages) ? requiredLanguages.join(' ') : requiredLanguages;
    const normalizedRequired = requiredText.toLowerCase();

    // Common language keywords
    const languageKeywords = ['english', 'dutch', 'german', 'french', 'spanish', 'polish', 'ukrainian', 'russian', 'nederlands', 'deutsch', 'français'];

    let matchCount = 0;
    let totalRequired = 0;

    languageKeywords.forEach(lang => {
        if (normalizedRequired.includes(lang)) {
            totalRequired++;
            if (userLangsArray.some(userLang => userLang.toLowerCase().includes(lang) || lang.includes(userLang.toLowerCase()))) {
                matchCount++;
            }
        }
    });

    if (totalRequired === 0) return 75; // No specific language mentioned

    return Math.round((matchCount / totalRequired) * 100);
}

/**
 * Calculate location match percentage
 */
function calculateLocationMatch(userLocations, vacancyLocation) {
    if (!userLocations || userLocations.length === 0) return 50; // Neutral if no preference
    if (!vacancyLocation) return 50; // Neutral if vacancy has no location

    const userLocsArray = Array.isArray(userLocations) ? userLocations : userLocations.split(',').map(l => l.trim());
    const normalizedVacancy = vacancyLocation.toLowerCase();

    // Check for exact or partial match
    const hasMatch = userLocsArray.some(loc => {
        const normalizedLoc = loc.toLowerCase();
        return normalizedVacancy.includes(normalizedLoc) || normalizedLoc.includes(normalizedVacancy);
    });

    return hasMatch ? 100 : 20; // Binary match for now
}

/**
 * Calculate salary match percentage
 */
function calculateSalaryMatch(expectedSalary, minSalary, maxSalary) {
    if (!expectedSalary) return 50; // Neutral if no expectation
    if (!minSalary && !maxSalary) return 50; // Neutral if no salary info

    const min = minSalary || 0;
    const max = maxSalary || minSalary || expectedSalary * 1.5;

    if (expectedSalary >= min && expectedSalary <= max) {
        return 100; // Perfect match
    } else if (expectedSalary < min) {
        // Salary offered is higher than expected - still good!
        return 90;
    } else {
        // Expected salary is higher than offered
        const gap = expectedSalary - max;
        const gapPercentage = (gap / expectedSalary) * 100;
        return Math.max(0, 100 - gapPercentage);
    }
}

/**
 * Calculate job type match percentage
 */
function calculateJobTypeMatch(userPreferences, vacancyJobType) {
    if (!userPreferences || userPreferences.length === 0) return 50; // Neutral
    if (!vacancyJobType) return 50; // Neutral

    const userPrefsArray = Array.isArray(userPreferences) ? userPreferences : userPreferences.split(',').map(p => p.trim());
    const normalizedVacancy = vacancyJobType.toLowerCase();

    // Check for match
    const hasMatch = userPrefsArray.some(pref => {
        const normalizedPref = pref.toLowerCase();
        return normalizedVacancy.includes(normalizedPref) || normalizedPref.includes(normalizedVacancy);
    });

    return hasMatch ? 100 : 30;
}

export default {
    calculateMatchScore
};
