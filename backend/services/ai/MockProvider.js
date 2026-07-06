/**
 * Mock AI Provider
 * Generates deterministic content without external API calls
 * Perfect for development and testing
 */

const AIProvider = require('./AIProvider');

class MockProvider extends AIProvider {
    constructor(seed) {
        super();
        this.seed = seed || 12345;
    }

    async generateContent({ assetType, userProfile, vacancy, userInput = {} }) {
        const mockId = this.generateMockId({
            assetType,
            userId: userProfile.id,
            vacancyId: vacancy.id,
            userInput
        });

        const generators = {
            resume: this.generateResume.bind(this),
            cover_letter: this.generateCoverLetter.bind(this),
            follow_up: this.generateFollowUp.bind(this)
        };

        if (!generators[assetType]) {
            throw new Error(`Unknown asset type: ${assetType}`);
        }

        return generators[assetType]({ mockId, userProfile, vacancy, userInput });
    }

    generateMockId(data) {
        // Deterministic hash based on input
        const str = JSON.stringify(data);
        let hash = this.seed;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0; // Convert to 32-bit integer
        }
        return `MOCK_${Math.abs(hash).toString(16).toUpperCase()}`;
    }

    generateResume({ mockId, userProfile, vacancy, userInput }) {
        const skills = userProfile.skills?.join(', ') || 'Various professional skills';
        const languages = userProfile.languages?.join(', ') || 'English';

        return `# ${userProfile.name}

**Contact Information**
- Email: ${userProfile.email}
- Phone: ${userProfile.phone || 'Available upon request'}
- Languages: ${languages}

## Professional Summary

${userInput.experience_summary || `Experienced professional with strong background in ${userProfile.skills?.slice(0, 3).join(', ')}. Seeking to leverage expertise in ${vacancy.title} role at ${vacancy.company_name}.`}

## Skills

${skills}

## Key Achievements

${userInput.achievements || `- Successfully delivered multiple projects on time and within budget
- Collaborated with cross-functional teams to achieve business objectives
- Consistently exceeded performance targets`}

## Work Experience

${userInput.work_history || `**Professional Experience**

Relevant experience in the field, demonstrating consistent growth and responsibility. Strong track record of delivering results and contributing to organizational success.`}

## Education

${userInput.education || 'Professional qualifications in relevant field'}

---
*ID: ${mockId} | Generated: ${new Date().toISOString()}*`;
    }

    generateCoverLetter({ mockId, userProfile, vacancy, userInput }) {
        const today = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        return `${today}

Dear Hiring Manager,

**RE: Application for ${vacancy.title} at ${vacancy.company_name}**

I am writing to express my strong interest in the ${vacancy.title} position at ${vacancy.company_name}. ${userInput.motivation || `With my background and skills, I believe I would be an excellent fit for this role.`}

**Why I'm a Great Fit**

${userInput.why_fit || `My experience aligns well with the requirements outlined in your job posting. I have demonstrated expertise in ${userProfile.skills?.slice(0, 2).join(' and ')}, which are key requirements for this position.`}

**What I Bring to the Team**

${userInput.value_proposition || `I am confident that my skills and dedication would make me a valuable asset to your team. I am particularly excited about the opportunity to contribute to ${vacancy.company_name}'s success.`}

I would welcome the opportunity to discuss how my experience and skills would benefit your organization. Thank you for considering my application.

Sincerely,

${userProfile.name}

---
*ID: ${mockId} | Generated: ${new Date().toISOString()}*`;
    }

    generateFollowUp({ mockId, userProfile, vacancy, userInput }) {
        return `Subject: Following Up on ${vacancy.title} Application

Dear Hiring Manager,

I hope this message finds you well. I recently submitted my application for the ${vacancy.title} position at ${vacancy.company_name}, and I wanted to follow up to reiterate my strong interest in this opportunity.

${userInput.follow_up_message || `I am very excited about the possibility of joining your team and contributing to ${vacancy.company_name}'s continued success.`}

I remain available for an interview at your earliest convenience and would be happy to provide any additional information you may need.

Thank you for your time and consideration.

Best regards,
${userProfile.name}
${userProfile.email}

---
*ID: ${mockId} | Generated: ${new Date().toISOString()}*`;
    }

    getName() {
        return 'MockProvider';
    }
}

module.exports = MockProvider;
