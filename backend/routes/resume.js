const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const PDFDocument = require('pdfkit');
const { db } = require('../database');
const authenticateToken = require('../middleware/auth');
const cvGenerationLimit = require('../middleware/cvGenerationLimit');

// Configure multer for PDF uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/resumes');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${req.user.id}-${Date.now()}`;
        cb(null, `resume-${uniqueSuffix}.pdf`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'), false);
        }
    }
});

// Configure multer for photo uploads
const photoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/photos');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
        cb(null, `photo-${req.user.id}-${Date.now()}${ext}`);
    }
});

const uploadPhoto = multer({
    storage: photoStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        file.mimetype.startsWith('image/')
            ? cb(null, true)
            : cb(new Error('Only image files are allowed'), false);
    }
});

// ============================================
// GET /api/resume - Fetch user's active resume
// ============================================
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM resumes WHERE user_id = $1',
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.json({
                status: 'none',
                message: 'No resume found',
                resume: null
            });
        }

        const resume = result.rows[0];

        res.json({
            status: resume.status,
            message: getStatusMessage(resume.status, resume.parse_error),
            resume: {
                id: resume.id,
                canonical_text: resume.canonical_text,
                full_name: resume.full_name,
                email: resume.email,
                phone: resume.phone,
                location: resume.location,
                linkedin_url: resume.linkedin_url,
                portfolio_url: resume.portfolio_url,
                summary: resume.summary,
                work_experience: resume.work_experience,
                education: resume.education,
                skills: resume.skills,
                certifications: resume.certifications,
                languages: resume.languages,
                uploaded_pdf_url: resume.uploaded_pdf_url,
                generated_pdf_url: resume.generated_pdf_url,
                photo_url: resume.photo_url,
                show_photo: resume.show_photo,
                last_generated_at: resume.last_generated_at,
                created_at: resume.created_at,
                updated_at: resume.updated_at
            }
        });
    } catch (error) {
        console.error('Error fetching resume:', error);
        res.status(500).json({ error: 'Failed to fetch resume' });
    }
});

// ============================================
// POST /api/resume/upload - Upload PDF and extract text
// ============================================
router.post('/upload', authenticateToken, upload.single('resume'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileUrl = `/uploads/resumes/${req.file.filename}`;

    try {
        // Read and parse PDF
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        const extractedText = pdfData.text;

        if (!extractedText || extractedText.trim().length < 50) {
            // Update status to parsing_failed
            await upsertResume(req.user.id, {
                uploaded_pdf_url: fileUrl,
                canonical_text: null,
                status: 'parsing_failed',
                parse_error: 'Could not extract meaningful text from PDF. The file may be image-based or corrupted.'
            });

            return res.status(400).json({
                error: 'Failed to extract text from PDF',
                status: 'parsing_failed',
                message: 'The PDF appears to be image-based or corrupted. Please upload a text-based PDF or use the resume generator.'
            });
        }

        // Parse structured data from text
        const structuredData = parseResumeText(extractedText);

        // Upsert resume record
        const resume = await upsertResume(req.user.id, {
            uploaded_pdf_url: fileUrl,
            canonical_text: extractedText,
            status: 'ready',
            parse_error: null,
            ...structuredData
        });

        res.json({
            success: true,
            status: 'ready',
            message: 'Resume uploaded and parsed successfully',
            resume: {
                id: resume.id,
                canonical_text: resume.canonical_text,
                ...structuredData,
                uploaded_pdf_url: resume.uploaded_pdf_url
            }
        });

    } catch (error) {
        console.error('Error processing PDF:', error);

        // Update status to parsing_failed
        await upsertResume(req.user.id, {
            uploaded_pdf_url: fileUrl,
            status: 'parsing_failed',
            parse_error: error.message
        });

        res.status(500).json({
            error: 'Failed to process PDF',
            status: 'parsing_failed',
            message: error.message
        });
    }
});

// ============================================
// POST /api/resume/generate - Generate resume from structured data
// ============================================
router.post('/generate', authenticateToken, cvGenerationLimit, async (req, res) => {
    const {
        full_name,
        email,
        phone,
        location,
        linkedin_url,
        portfolio_url,
        summary,
        work_experience,
        education,
        skills,
        certifications,
        languages
    } = req.body;

    // Validate required fields
    if (!full_name || !email) {
        return res.status(400).json({
            error: 'Missing required fields',
            message: 'Full name and email are required'
        });
    }

    try {
        // Generate canonical text from structured data
        const canonicalText = generateCanonicalText({
            full_name,
            email,
            phone,
            location,
            linkedin_url,
            portfolio_url,
            summary,
            work_experience: work_experience || [],
            education: education || [],
            skills: skills || [],
            certifications: certifications || [],
            languages: languages || []
        });

        // Generate PDF
        const pdfFilename = `resume-${req.user.id}-${Date.now()}.pdf`;
        const pdfPath = path.join(__dirname, '../uploads/resumes', pdfFilename);
        const pdfUrl = `/uploads/resumes/${pdfFilename}`;

        // Ensure directory exists
        const uploadDir = path.dirname(pdfPath);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        await generatePDF({
            full_name,
            email,
            phone,
            location,
            linkedin_url,
            portfolio_url,
            summary,
            work_experience: work_experience || [],
            education: education || [],
            skills: skills || [],
            certifications: certifications || [],
            languages: languages || []
        }, pdfPath);

        // Upsert resume record
        const resume = await upsertResume(req.user.id, {
            canonical_text: canonicalText,
            full_name,
            email,
            phone,
            location,
            linkedin_url,
            portfolio_url,
            summary,
            work_experience: JSON.stringify(work_experience || []),
            education: JSON.stringify(education || []),
            skills: JSON.stringify(skills || []),
            certifications: JSON.stringify(certifications || []),
            languages: JSON.stringify(languages || []),
            generated_pdf_url: pdfUrl,
            status: 'ready',
            parse_error: null,
            last_generated_at: new Date()
        });

        res.json({
            success: true,
            status: 'ready',
            message: 'Resume generated successfully',
            resume: {
                id: resume.id,
                canonical_text: canonicalText,
                full_name,
                email,
                phone,
                location,
                linkedin_url,
                portfolio_url,
                summary,
                work_experience,
                education,
                skills,
                certifications,
                languages,
                generated_pdf_url: pdfUrl,
                last_generated_at: resume.last_generated_at
            }
        });

    } catch (error) {
        console.error('Error generating resume:', error);
        res.status(500).json({
            error: 'Failed to generate resume',
            message: error.message
        });
    }
});

// ============================================
// PUT /api/resume - Update resume data
// ============================================
router.put('/', authenticateToken, async (req, res) => {
    const {
        full_name,
        email,
        phone,
        location,
        linkedin_url,
        portfolio_url,
        summary,
        work_experience,
        education,
        skills,
        certifications,
        languages
    } = req.body;

    try {
        // Regenerate canonical text
        const canonicalText = generateCanonicalText({
            full_name,
            email,
            phone,
            location,
            linkedin_url,
            portfolio_url,
            summary,
            work_experience: work_experience || [],
            education: education || [],
            skills: skills || [],
            certifications: certifications || [],
            languages: languages || []
        });

        const resume = await upsertResume(req.user.id, {
            canonical_text: canonicalText,
            full_name,
            email,
            phone,
            location,
            linkedin_url,
            portfolio_url,
            summary,
            work_experience: JSON.stringify(work_experience || []),
            education: JSON.stringify(education || []),
            skills: JSON.stringify(skills || []),
            certifications: JSON.stringify(certifications || []),
            languages: JSON.stringify(languages || []),
            status: 'ready'
        });

        res.json({
            success: true,
            message: 'Resume updated successfully',
            resume
        });

    } catch (error) {
        console.error('Error updating resume:', error);
        res.status(500).json({ error: 'Failed to update resume' });
    }
});

// ============================================
// POST /api/resume/regenerate-pdf - Regenerate PDF from current data
// ============================================
router.post('/regenerate-pdf', authenticateToken, cvGenerationLimit, async (req, res) => {
    try {
        // Get current resume data
        const result = await db.query(
            'SELECT * FROM resumes WHERE user_id = $1',
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No resume found' });
        }

        const resume = result.rows[0];

        // Generate new PDF
        const pdfFilename = `resume-${req.user.id}-${Date.now()}.pdf`;
        const pdfPath = path.join(__dirname, '../uploads/resumes', pdfFilename);
        const pdfUrl = `/uploads/resumes/${pdfFilename}`;

        await generatePDF({
            full_name: resume.full_name,
            email: resume.email,
            phone: resume.phone,
            location: resume.location,
            linkedin_url: resume.linkedin_url,
            portfolio_url: resume.portfolio_url,
            summary: resume.summary,
            work_experience: resume.work_experience || [],
            education: resume.education || [],
            skills: resume.skills || [],
            certifications: resume.certifications || [],
            languages: resume.languages || []
        }, pdfPath);

        // Update resume with new PDF URL
        await db.query(
            'UPDATE resumes SET generated_pdf_url = $1, last_generated_at = NOW() WHERE user_id = $2',
            [pdfUrl, req.user.id]
        );

        res.json({
            success: true,
            message: 'PDF regenerated successfully',
            generated_pdf_url: pdfUrl
        });

    } catch (error) {
        console.error('Error regenerating PDF:', error);
        res.status(500).json({ error: 'Failed to regenerate PDF' });
    }
});

// ============================================
// POST /api/resume/photo - Upload profile photo
// ============================================
router.post('/photo', authenticateToken, uploadPhoto.single('photo'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No photo uploaded' });
    }

    const photoUrl = `/uploads/photos/${req.file.filename}`;

    try {
        await upsertResume(req.user.id, { photo_url: photoUrl });
        res.json({ success: true, photo_url: photoUrl });
    } catch (error) {
        console.error('Error saving photo:', error);
        res.status(500).json({ error: 'Failed to save photo' });
    }
});

// ============================================
// PUT /api/resume/photo-toggle - Toggle show/hide photo
// ============================================
router.put('/photo-toggle', authenticateToken, async (req, res) => {
    const { show_photo } = req.body;

    try {
        await upsertResume(req.user.id, { show_photo: !!show_photo });
        res.json({ success: true, show_photo: !!show_photo });
    } catch (error) {
        console.error('Error toggling photo:', error);
        res.status(500).json({ error: 'Failed to update photo setting' });
    }
});

// ============================================
// DELETE /api/resume - Delete user's resume
// ============================================
router.delete('/', authenticateToken, async (req, res) => {
    try {
        // Get resume to find file paths
        const result = await db.query(
            'SELECT uploaded_pdf_url, generated_pdf_url FROM resumes WHERE user_id = $1',
            [req.user.id]
        );

        if (result.rows.length > 0) {
            const resume = result.rows[0];

            // Delete uploaded PDF file if exists
            if (resume.uploaded_pdf_url) {
                const uploadedPath = path.join(__dirname, '..', resume.uploaded_pdf_url);
                if (fs.existsSync(uploadedPath)) {
                    fs.unlinkSync(uploadedPath);
                }
            }

            // Delete generated PDF file if exists
            if (resume.generated_pdf_url) {
                const generatedPath = path.join(__dirname, '..', resume.generated_pdf_url);
                if (fs.existsSync(generatedPath)) {
                    fs.unlinkSync(generatedPath);
                }
            }
        }

        // Delete from database
        await db.query('DELETE FROM resumes WHERE user_id = $1', [req.user.id]);

        res.json({
            success: true,
            message: 'Resume deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting resume:', error);
        res.status(500).json({ error: 'Failed to delete resume' });
    }
});

// ============================================
// Helper Functions
// ============================================

function getStatusMessage(status, parseError) {
    switch (status) {
        case 'ready':
            return 'Ready for auto-apply';
        case 'draft':
            return 'Resume incomplete - please add more information';
        case 'parsing_failed':
            return parseError || 'Failed to parse PDF';
        case 'generating':
            return 'Generating PDF...';
        default:
            return 'No resume';
    }
}

async function upsertResume(userId, data) {
    // Check if resume exists
    const existing = await db.query(
        'SELECT id FROM resumes WHERE user_id = $1',
        [userId]
    );

    if (existing.rows.length > 0) {
        // Update existing
        const fields = Object.keys(data);
        const values = Object.values(data);
        const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');

        const result = await db.query(
            `UPDATE resumes SET ${setClause}, updated_at = NOW() WHERE user_id = $1 RETURNING *`,
            [userId, ...values]
        );
        return result.rows[0];
    } else {
        // Insert new
        const fields = ['user_id', ...Object.keys(data)];
        const values = [userId, ...Object.values(data)];
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

        const result = await db.query(
            `INSERT INTO resumes (${fields.join(', ')}) VALUES (${placeholders}) RETURNING *`,
            values
        );
        return result.rows[0];
    }
}

function parseResumeText(text) {
    // Basic parsing - extract common resume sections
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);

    // Try to extract email
    const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
    const email = emailMatch ? emailMatch[0] : null;

    // Try to extract phone
    const phoneMatch = text.match(/[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[(]?[0-9]{1,3}[)]?[-\s\.]?[0-9]{3,6}[-\s\.]?[0-9]{3,6}/);
    const phone = phoneMatch ? phoneMatch[0] : null;

    // Try to extract LinkedIn
    const linkedinMatch = text.match(/linkedin\.com\/in\/[\w-]+/i);
    const linkedin_url = linkedinMatch ? `https://${linkedinMatch[0]}` : null;

    // First non-empty line is often the name
    const full_name = lines[0] || null;

    return {
        full_name,
        email,
        phone,
        linkedin_url,
        // Other fields would require more sophisticated NLP parsing
        // For now, we store the full text as canonical_text which is the source of truth
    };
}

function generateCanonicalText(data) {
    const lines = [];

    // Header
    lines.push(data.full_name || 'Name');
    if (data.email) lines.push(data.email);
    if (data.phone) lines.push(data.phone);
    if (data.location) lines.push(data.location);

    const links = [];
    if (data.linkedin_url) links.push(data.linkedin_url);
    if (data.portfolio_url) links.push(data.portfolio_url);
    if (links.length) lines.push(links.join(' | '));

    lines.push('');

    // Summary
    if (data.summary) {
        lines.push('PROFESSIONAL SUMMARY');
        lines.push(data.summary);
        lines.push('');
    }

    // Work Experience
    if (data.work_experience && data.work_experience.length > 0) {
        lines.push('WORK EXPERIENCE');
        for (const job of data.work_experience) {
            lines.push(`${job.title || 'Position'} at ${job.company || 'Company'}`);
            if (job.location) lines.push(job.location);
            if (job.start_date || job.end_date) {
                lines.push(`${job.start_date || ''} - ${job.end_date || 'Present'}`);
            }
            if (job.description) lines.push(job.description);
            if (job.achievements && job.achievements.length > 0) {
                for (const achievement of job.achievements) {
                    lines.push(`• ${achievement}`);
                }
            }
            lines.push('');
        }
    }

    // Education
    if (data.education && data.education.length > 0) {
        lines.push('EDUCATION');
        for (const edu of data.education) {
            lines.push(`${edu.degree || 'Degree'} in ${edu.field || 'Field'}`);
            lines.push(edu.institution || 'Institution');
            if (edu.start_date || edu.end_date) {
                lines.push(`${edu.start_date || ''} - ${edu.end_date || ''}`);
            }
            if (edu.gpa) lines.push(`GPA: ${edu.gpa}`);
            lines.push('');
        }
    }

    // Skills
    if (data.skills && data.skills.length > 0) {
        lines.push('SKILLS');
        const skillNames = data.skills.map(s => typeof s === 'string' ? s : s.name);
        lines.push(skillNames.join(', '));
        lines.push('');
    }

    // Certifications
    if (data.certifications && data.certifications.length > 0) {
        lines.push('CERTIFICATIONS');
        for (const cert of data.certifications) {
            const certName = typeof cert === 'string' ? cert : cert.name;
            lines.push(`• ${certName}`);
        }
        lines.push('');
    }

    // Languages
    if (data.languages && data.languages.length > 0) {
        lines.push('LANGUAGES');
        const langList = data.languages.map(l => {
            if (typeof l === 'string') return l;
            const name = l.language || l.name || '';
            return l.proficiency ? `${name} (${l.proficiency})` : name;
        });
        lines.push(langList.join(', '));
    }

    return lines.join('\n');
}

function generatePDF(data, outputPath) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 50
            });

            const stream = fs.createWriteStream(outputPath);
            doc.pipe(stream);

            // Header - Name
            doc.fontSize(24).font('Helvetica-Bold')
                .text(data.full_name || 'Name', { align: 'center' });

            // Contact info
            doc.fontSize(10).font('Helvetica');
            const contactParts = [];
            if (data.email) contactParts.push(data.email);
            if (data.phone) contactParts.push(data.phone);
            if (data.location) contactParts.push(data.location);
            if (contactParts.length) {
                doc.text(contactParts.join(' | '), { align: 'center' });
            }

            // Links
            const links = [];
            if (data.linkedin_url) links.push(data.linkedin_url);
            if (data.portfolio_url) links.push(data.portfolio_url);
            if (links.length) {
                doc.text(links.join(' | '), { align: 'center' });
            }

            doc.moveDown();

            // Summary
            if (data.summary) {
                addSection(doc, 'PROFESSIONAL SUMMARY');
                doc.fontSize(10).font('Helvetica')
                    .text(data.summary);
                doc.moveDown();
            }

            // Work Experience
            if (data.work_experience && data.work_experience.length > 0) {
                addSection(doc, 'WORK EXPERIENCE');
                for (const job of data.work_experience) {
                    doc.fontSize(11).font('Helvetica-Bold')
                        .text(`${job.title || 'Position'} at ${job.company || 'Company'}`);

                    const jobMeta = [];
                    if (job.location) jobMeta.push(job.location);
                    if (job.start_date || job.end_date) {
                        jobMeta.push(`${job.start_date || ''} - ${job.end_date || 'Present'}`);
                    }
                    if (jobMeta.length) {
                        doc.fontSize(9).font('Helvetica-Oblique')
                            .text(jobMeta.join(' | '));
                    }

                    if (job.description) {
                        doc.fontSize(10).font('Helvetica')
                            .text(job.description);
                    }

                    if (job.achievements && job.achievements.length > 0) {
                        doc.fontSize(10).font('Helvetica');
                        for (const achievement of job.achievements) {
                            doc.text(`• ${achievement}`, { indent: 10 });
                        }
                    }
                    doc.moveDown(0.5);
                }
            }

            // Education
            if (data.education && data.education.length > 0) {
                addSection(doc, 'EDUCATION');
                for (const edu of data.education) {
                    doc.fontSize(11).font('Helvetica-Bold')
                        .text(`${edu.degree || 'Degree'}${edu.field ? ` in ${edu.field}` : ''}`);
                    doc.fontSize(10).font('Helvetica')
                        .text(edu.institution || 'Institution');

                    const eduMeta = [];
                    if (edu.start_date || edu.end_date) {
                        eduMeta.push(`${edu.start_date || ''} - ${edu.end_date || ''}`);
                    }
                    if (edu.gpa) eduMeta.push(`GPA: ${edu.gpa}`);
                    if (eduMeta.length) {
                        doc.fontSize(9).font('Helvetica-Oblique')
                            .text(eduMeta.join(' | '));
                    }
                    doc.moveDown(0.5);
                }
            }

            // Skills
            if (data.skills && data.skills.length > 0) {
                addSection(doc, 'SKILLS');
                const skillNames = data.skills.map(s => typeof s === 'string' ? s : s.name);
                doc.fontSize(10).font('Helvetica')
                    .text(skillNames.join(', '));
                doc.moveDown();
            }

            // Certifications
            if (data.certifications && data.certifications.length > 0) {
                addSection(doc, 'CERTIFICATIONS');
                doc.fontSize(10).font('Helvetica');
                for (const cert of data.certifications) {
                    const certName = typeof cert === 'string' ? cert : cert.name;
                    doc.text(`• ${certName}`);
                }
                doc.moveDown();
            }

            // Languages
            if (data.languages && data.languages.length > 0) {
                addSection(doc, 'LANGUAGES');
                const langList = data.languages.map(l => {
                    if (typeof l === 'string') return l;
                    const name = l.language || l.name || '';
                    return l.proficiency ? `${name} (${l.proficiency})` : name;
                });
                doc.fontSize(10).font('Helvetica')
                    .text(langList.join(', '));
            }

            doc.end();

            stream.on('finish', () => resolve(outputPath));
            stream.on('error', reject);

        } catch (error) {
            reject(error);
        }
    });
}

function addSection(doc, title) {
    doc.fontSize(12).font('Helvetica-Bold')
        .text(title);
    doc.moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke();
    doc.moveDown(0.3);
}

// ============================================
// POST /api/resume/generate-skill-descriptions
// ============================================
router.post('/generate-skill-descriptions', authenticateToken, async (req, res) => {
    const { skills, work_experience = [], projects = [] } = req.body;

    if (!skills || !Array.isArray(skills) || skills.length === 0) {
        return res.status(400).json({ error: 'skills array is required' });
    }

    // Normalise skill names (accept string or { name } shape)
    const skillNames = skills.map(s => (typeof s === 'string' ? s : s?.name || '')).filter(Boolean);
    if (skillNames.length === 0) {
        return res.status(400).json({ error: 'No valid skill names found' });
    }

    // Build compact work context text
    const expText = work_experience.map(e => {
        const bullets = (e.achievements || []).join('; ') || e.description || '';
        return `${e.title || ''} at ${e.company || ''}: ${bullets}`;
    }).join('\n');

    const projText = projects.map(p =>
        `${p.name || ''}: ${p.description || ''} [${(p.technologies || []).join(', ')}]`
    ).join('\n');

    const prompt = `You are a professional CV writer. Write a concise 1-sentence description for EVERY skill in the list, showing how this person used it based on their work history. Every skill must get a description — no exceptions.

WORK EXPERIENCE:
${expText || '(none provided)'}

PROJECTS:
${projText || '(none provided)'}

SKILLS TO DESCRIBE: ${skillNames.join(', ')}

Return ONLY a JSON array — no markdown, no code block, no explanation:
[{ "name": "SkillName", "desc": "one sentence" }, ...]

Rules:
- Every skill MUST have a non-empty desc
- If the work history doesn't mention a skill directly, infer a plausible usage based on the person's industry and role
- Be specific and professional — mention tools, outcomes, or contexts
- Keep each desc under 120 characters
- Use the exact skill name as provided in the name field`;

    try {
        const geminiService = require('../services/geminiService');
        const { model } = geminiService._getModel();
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().replace(/```json|```/g, '').trim();

        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch {
            return res.status(500).json({ error: 'Failed to parse AI response', raw: text });
        }

        if (!Array.isArray(parsed)) {
            return res.status(500).json({ error: 'Unexpected AI response shape' });
        }

        res.json({ skills: parsed });
    } catch (err) {
        console.error('generate-skill-descriptions error:', err);
        res.status(500).json({ error: 'AI generation failed', message: err.message });
    }
});

// ============================================
// POST /api/resume/export-html-pdf — Puppeteer pixel-perfect export
// ============================================

const ALLOWED_FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);

// Replace src attributes pointing at local /uploads/* paths with base64 data URIs
// so Puppeteer can render them without any outbound network request.
const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');
async function embedLocalImages(htmlStr) {
    const re = /src="([^"]+)"/g;
    const matches = [...htmlStr.matchAll(re)];
    for (const [full, src] of matches) {
        let localPath;
        try {
            const pathname = src.startsWith('http') ? new URL(src).pathname : src;
            if (!pathname.startsWith('/uploads/')) continue;
            localPath = path.resolve(UPLOADS_DIR, '..', pathname.slice(1));
            if (!localPath.startsWith(UPLOADS_DIR + path.sep) && localPath !== UPLOADS_DIR) continue;
            const buf = await fs.promises.readFile(localPath);
            const ext = path.extname(localPath).slice(1).toLowerCase();
            const mime = { jpg: 'jpeg', jpeg: 'jpeg', png: 'png', webp: 'webp', gif: 'gif' }[ext] || 'jpeg';
            htmlStr = htmlStr.replace(full, `src="data:image/${mime};base64,${buf.toString('base64')}"`);
        } catch { /* file unreadable — leave src as-is */ }
    }
    return htmlStr;
}

function sanitizeFontLinks(fontLinks = []) {
    return fontLinks.filter(link => {
        try {
            const url = new URL(link);
            return url.protocol === 'https:' && ALLOWED_FONT_HOSTS.has(url.hostname);
        } catch {
            return false;
        }
    });
}

router.post('/export-html-pdf', authenticateToken, async (req, res) => {
    const { html, fontLinks = [], fileName = 'cv' } = req.body;

    if (!html) return res.status(400).json({ error: 'HTML content required' });

    let browser;
    try {
        const puppeteer = require('puppeteer');

        const safeHtml = await embedLocalImages(html);
        const safeFontLinks = sanitizeFontLinks(fontLinks);
        const fontTags = safeFontLinks
            .map(url => `<link rel="stylesheet" href="${url}">`)
            .join('\n');

        const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${fontTags}
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .cv-canvas { display: block !important; box-shadow: none !important; border-radius: 0 !important; }
  </style>
</head>
<body>${safeHtml}</body>
</html>`;

        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });

        const page = await browser.newPage();

        // Block all requests except to the allowlisted font hosts and data URIs.
        // This is defense-in-depth: sanitizeFontLinks already prevents injection
        // via fontLinks, but the HTML body could reference external resources.
        await page.setRequestInterception(true);
        page.on('request', req => {
            const url = req.url();
            if (url.startsWith('data:')) return req.continue();
            try {
                const { protocol, hostname } = new URL(url);
                if (protocol === 'https:' && ALLOWED_FONT_HOSTS.has(hostname)) return req.continue();
            } catch { /* fall through to abort */ }
            req.abort();
        });

        await page.setJavaScriptEnabled(false);
        // deviceScaleFactor intentionally omitted — HiDPI causes subtle font-metric
        // differences vs the user's browser, which push content onto a second page.
        await page.setViewport({ width: 794, height: 1123 });
        await page.setContent(fullHtml, { waitUntil: 'networkidle0', timeout: 30000 });

        // Measure rendered height and scale down to fit A4 if content overflows.
        // page.evaluate() bypasses setJavaScriptEnabled and always works via CDP.
        const docHeight = await page.evaluate(() => document.documentElement.scrollHeight);
        const A4_PX = 1123; // 297 mm at 96 CSS dpi
        if (docHeight > A4_PX) {
            const scale = (A4_PX / docHeight).toFixed(6);
            await page.addStyleTag({
                content: [
                    'html { overflow: hidden; }',
                    `body { transform: scale(${scale}); transform-origin: top center; }`,
                ].join(' '),
            });
        }

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
        });

        const safeName = fileName.replace(/[^a-z0-9-_]/gi, '-').slice(0, 80) || 'cv';
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
            'Content-Length': pdfBuffer.length,
        });
        res.end(pdfBuffer, 'binary');

    } catch (error) {
        console.error('Puppeteer PDF export error:', error);
        res.status(500).json({ error: 'PDF export failed', details: error.message });
    } finally {
        if (browser) await browser.close().catch(() => {});
    }
});

module.exports = router;
