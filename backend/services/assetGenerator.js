/**
 * Asset Generation Service
 * Handles generation of job-specific resumes, cover letters, and follow-up emails
 * using OpenAI API. Generates both PDF and DOCX formats.
 */

const OpenAI = require('openai');
const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/postgres');

class AssetGeneratorService {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        this.storageBasePath = process.env.STORAGE_BASE_URL || './storage';
        this.ensureStorageDir();
    }

    async ensureStorageDir() {
        try {
            await fs.mkdir(this.storageBasePath, { recursive: true });
        } catch (error) {
            console.error('Failed to create storage directory:', error);
        }
    }

    /**
     * Generate job-specific asset (resume, cover letter, or follow-up email)
     * @param {Object} params - Generation parameters
     * @param {number} params.userId - User ID
     * @param {number} params.vacancyId - Vacancy ID
     * @param {string} params.assetType - 'resume', 'cover_letter', or 'follow_up'
     * @param {string} params.templateId - Optional template ID (UUID)
     * @returns {Promise<{pdfAssetId: string, docxAssetId: string, pdfUrl: string, docxUrl: string}>}
     */
    async generateAsset({ userId, vacancyId, assetType, templateId = null }) {
        console.log(`🎨 Generating ${assetType} for user ${userId}, vacancy ${vacancyId}`);

        // 1. Validate eligibility
        await this.validateEligibility(userId, vacancyId, templateId);

        // 2. Fetch context
        const context = await this.fetchContext(userId, vacancyId, templateId);

        // 3. Call OpenAI API
        const content = await this.callOpenAI(assetType, context);

        // 4. Generate documents (PDF + DOCX)
        const timestamp = Date.now();
        const { pdfPath, docxPath } = await this.generateDocuments(
            userId,
            vacancyId,
            assetType,
            content,
            timestamp
        );

        // 5. Upload to storage and get URLs
        const pdfUrl = await this.getFileUrl(pdfPath);
        const docxUrl = await this.getFileUrl(docxPath);

        // 6. Insert into application_assets with atomic activation
        const { pdfAssetId, docxAssetId } = await this.insertAssets({
            userId,
            vacancyId,
            assetType,
            pdfUrl,
            docxUrl
        });

        console.log(`✅ Generated ${assetType}: PDF ${pdfAssetId}, DOCX ${docxAssetId}`);

        return { pdfAssetId, docxAssetId, pdfUrl, docxUrl };
    }

    /**
     * Validate user, vacancy, and template exist
     */
    async validateEligibility(userId, vacancyId, templateId) {
        // Check user exists
        const userResult = await db.query(
            'SELECT id FROM users WHERE id = $1',
            [userId]
        );
        if (userResult.rows.length === 0) {
            throw new Error(`User ${userId} not found`);
        }

        // Check vacancy exists and is active
        const vacancyResult = await db.query(
            'SELECT id, is_active FROM vacancies WHERE id = $1',
            [vacancyId]
        );
        if (vacancyResult.rows.length === 0) {
            throw new Error(`Vacancy ${vacancyId} not found`);
        }
        if (!vacancyResult.rows[0].is_active) {
            throw new Error(`Vacancy ${vacancyId} is not active`);
        }

        // Check template if specified
        if (templateId) {
            const templateResult = await db.query(
                'SELECT id FROM resume_templates WHERE id = $1 AND user_id = $2',
                [templateId, userId]
            );
            if (templateResult.rows.length === 0) {
                throw new Error(`Template ${templateId} not found for user ${userId}`);
            }
        }
    }

    /**
     * Fetch context for generation
     */
    async fetchContext(userId, vacancyId, templateId) {
        // Fetch vacancy details
        const vacancyResult = await db.query(
            `SELECT title, description, requirements, responsibilities, 
              company_name, required_skills, preferred_skills
       FROM vacancies WHERE id = $1`,
            [vacancyId]
        );
        const vacancy = vacancyResult.rows[0];

        // Fetch user profile
        const userResult = await db.query(
            `SELECT name, email, phone, skills, experience, 
              personality, languages, availability
       FROM users WHERE id = $1`,
            [userId]
        );
        const user = userResult.rows[0];

        // Fetch template if specified
        let template = null;
        if (templateId) {
            const templateResult = await db.query(
                'SELECT name, base_doc_url FROM resume_templates WHERE id = $1',
                [templateId]
            );
            template = templateResult.rows[0];
        }

        return { vacancy, user, template };
    }

    /**
     * Call OpenAI API to generate content
     */
    async callOpenAI(assetType, context) {
        const { vacancy, user } = context;

        const prompts = {
            resume: this.getResumePrompt(vacancy, user),
            cover_letter: this.getCoverLetterPrompt(vacancy, user),
            follow_up: this.getFollowUpPrompt(vacancy, user)
        };

        const prompt = prompts[assetType];
        if (!prompt) {
            throw new Error(`Invalid asset type: ${assetType}`);
        }

        console.log(`🤖 Calling OpenAI for ${assetType}...`);

        const response = await this.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert career coach and resume writer. Generate professional, ATS-friendly content.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 2000
        });

        return response.choices[0].message.content;
    }

    getResumePrompt(vacancy, user) {
        return `Generate a professional resume tailored for this job:

JOB DETAILS:
- Title: ${vacancy.title}
- Company: ${vacancy.company_name}
- Description: ${vacancy.description || 'N/A'}
- Required Skills: ${vacancy.required_skills?.join(', ') || 'N/A'}

CANDIDATE PROFILE:
- Name: ${user.name}
- Email: ${user.email}
- Phone: ${user.phone || 'N/A'}
- Skills: ${user.skills?.join(', ') || 'N/A'}
- Experience: ${JSON.stringify(user.experience) || 'N/A'}
- Languages: ${user.languages?.join(', ') || 'N/A'}

Generate a complete resume in plain text format with clear sections:
- Contact Information
- Professional Summary (2-3 sentences highlighting relevant experience)
- Skills (emphasize skills matching the job)
- Work Experience (if available)
- Education (if available)

Keep it concise, professional, and ATS-friendly.`;
    }

    getCoverLetterPrompt(vacancy, user) {
        return `Generate a professional cover letter for this job application:

JOB DETAILS:
- Title: ${vacancy.title}
- Company: ${vacancy.company_name}
- Description: ${vacancy.description || 'N/A'}

CANDIDATE:
- Name: ${user.name}
- Skills: ${user.skills?.join(', ') || 'N/A'}
- Experience: ${JSON.stringify(user.experience) || 'N/A'}

Write a compelling cover letter (3-4 paragraphs) that:
1. Expresses interest in the position
2. Highlights relevant skills and experience
3. Explains why the candidate is a good fit
4. Includes a professional closing

Use a professional but warm tone.`;
    }

    getFollowUpPrompt(vacancy, user) {
        return `Generate a professional follow-up email for a job application:

JOB DETAILS:
- Title: ${vacancy.title}
- Company: ${vacancy.company_name}

CANDIDATE:
- Name: ${user.name}

Write a brief, professional follow-up email (2-3 paragraphs) that:
1. References the application submission
2. Reiterates interest in the position
3. Politely inquires about the application status
4. Thanks the recipient for their time

Keep it concise and professional.`;
    }

    /**
     * Generate PDF and DOCX documents from content
     */
    async generateDocuments(userId, vacancyId, assetType, content, timestamp) {
        const baseDir = path.join(this.storageBasePath, `${userId}`, `${vacancyId}`);
        await fs.mkdir(baseDir, { recursive: true });

        const baseName = `${assetType}_${timestamp}`;
        const pdfPath = path.join(baseDir, `${baseName}.pdf`);
        const docxPath = path.join(baseDir, `${baseName}.docx`);

        // Generate PDF
        await this.generatePDF(content, pdfPath);

        // Generate DOCX
        await this.generateDOCX(content, docxPath);

        return { pdfPath, docxPath };
    }

    /**
     * Generate PDF using PDFKit
     */
    async generatePDF(content, outputPath) {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ margin: 50 });
            const stream = require('fs').createWriteStream(outputPath);

            doc.pipe(stream);

            // Add content with basic formatting
            const lines = content.split('\n');
            lines.forEach(line => {
                if (line.trim().length === 0) {
                    doc.moveDown(0.5);
                } else if (line.match(/^[A-Z\s]+$/)) {
                    // All caps = heading
                    doc.fontSize(14).font('Helvetica-Bold').text(line.trim(), { align: 'left' });
                    doc.moveDown(0.3);
                } else {
                    doc.fontSize(11).font('Helvetica').text(line.trim(), { align: 'left' });
                }
            });

            doc.end();
            stream.on('finish', resolve);
            stream.on('error', reject);
        });
    }

    /**
     * Generate DOCX using docx library
     */
    async generateDOCX(content, outputPath) {
        const lines = content.split('\n');
        const paragraphs = lines.map(line => {
            if (line.trim().length === 0) {
                return new Paragraph({ text: '' });
            } else if (line.match(/^[A-Z\s]+$/)) {
                // All caps = heading
                return new Paragraph({
                    text: line.trim(),
                    heading: HeadingLevel.HEADING_2
                });
            } else {
                return new Paragraph({
                    children: [new TextRun(line.trim())]
                });
            }
        });

        const doc = new Document({
            sections: [{
                properties: {},
                children: paragraphs
            }]
        });

        const buffer = await Packer.toBuffer(doc);
        await fs.writeFile(outputPath, buffer);
    }

    /**
     * Get file URL (local path or cloud URL)
     */
    async getFileUrl(filePath) {
        // For local storage, return relative path
        // For cloud storage (S3, R2), upload and return public URL
        return filePath.replace(/\\/g, '/'); // Normalize path separators
    }

    /**
     * Insert assets into database with atomic activation
     */
    async insertAssets({ userId, vacancyId, assetType, pdfUrl, docxUrl }) {
        const client = await db.getClient();

        try {
            await client.query('BEGIN');

            // Deactivate all existing assets of same type for same vacancy
            await client.query(
                `UPDATE application_assets 
         SET is_active = false 
         WHERE user_id = $1 AND vacancy_id = $2 AND type = $3`,
                [userId, vacancyId, assetType]
            );

            // Insert PDF asset
            const pdfResult = await client.query(
                `INSERT INTO application_assets 
         (id, user_id, vacancy_id, type, format, file_url, is_user_uploaded, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
                [uuidv4(), userId, vacancyId, assetType, 'pdf', pdfUrl, false, true]
            );

            // Insert DOCX asset
            const docxResult = await client.query(
                `INSERT INTO application_assets 
         (id, user_id, vacancy_id, type, format, file_url, is_user_uploaded, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
                [uuidv4(), userId, vacancyId, assetType, 'docx', docxUrl, false, true]
            );

            await client.query('COMMIT');

            return {
                pdfAssetId: pdfResult.rows[0].id,
                docxAssetId: docxResult.rows[0].id
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

// Singleton instance
const assetGenerator = new AssetGeneratorService();

module.exports = assetGenerator;
