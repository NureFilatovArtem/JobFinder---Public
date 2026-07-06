const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db } = require('../database');
const geminiService = require('../services/geminiService');

// Note: authenticateToken is applied at the app.use() level in server.js
// req.user.id is available on all routes in this router

const ALGO = 'aes-256-gcm';

// True only when real Google OAuth credentials are present — guards against
// running with the .env placeholder, which causes a Google `invalid_client`
// error only at the very end of the flow.
function isOAuthConfigured() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  return Boolean(id && secret && !secret.includes('PASTE_YOUR'));
}

function encrypt(text) {
  const key = Buffer.from(process.env.ENCRYPTION_KEY || 'default-dev-key-32bytes-padded!!', 'utf8').slice(0, 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + enc.toString('hex');
}

function decrypt(text) {
  const key = Buffer.from(process.env.ENCRYPTION_KEY || 'default-dev-key-32bytes-padded!!', 'utf8').slice(0, 32);
  const [ivHex, tagHex, encHex] = text.split(':');
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8');
}

// ── MIME email building ─────────────────────────────────────────────────────
// A well-formed message (proper headers + encodings + an HTML part) is far
// less likely to be flagged as spam than a bare text/plain blob.

// RFC 2047 "encoded-word" — keeps non-ASCII subjects/names valid in headers.
function encodeHeaderWord(str) {
  if (!str) return '';
  if (/^[\x00-\x7F]*$/.test(str)) return str; // pure ASCII — leave untouched
  return '=?UTF-8?B?' + Buffer.from(str, 'utf8').toString('base64') + '?=';
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Build a multipart/alternative RFC 5322 message with text + HTML parts.
function buildRawEmail({ fromName, fromEmail, to, subject, body }) {
  const boundary = 'jf_' + crypto.randomBytes(12).toString('hex');
  const text = body || '';
  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;' +
    'color:#202124;line-height:1.6">' +
    escapeHtml(text).replace(/\r?\n/g, '<br>') +
    '</div>';
  // base64-encode bodies and wrap at 76 chars (RFC 2045).
  const b64 = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n');

  return [
    `From: ${fromName ? `${encodeHeaderWord(fromName)} <${fromEmail}>` : fromEmail}`,
    `To: ${to}`,
    `Reply-To: ${fromEmail}`,
    `Subject: ${encodeHeaderWord(subject || '(no subject)')}`,
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(text),
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(html),
    '',
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

// ── Gmail tracking modes ────────────────────────────────────────────────────
// 'manual'      — send only, no inbox reading (Mode 1)
// 'lightweight' — read only the threads we sent, headers only (Mode 2)
// 'full'        — gmail.readonly for AI body analysis (Mode 3, future)
const TRACKING_MODES = ['manual', 'lightweight', 'full'];

// OAuth scopes granted for each tracking mode. Higher modes add read access;
// lower modes stay minimal for privacy.
function scopesForMode(mode) {
  const base = [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/gmail.send',
  ];
  if (mode === 'lightweight') base.push('https://www.googleapis.com/auth/gmail.metadata');
  if (mode === 'full') base.push('https://www.googleapis.com/auth/gmail.readonly');
  return base;
}

// Return a usable access token for an account, transparently refreshing an
// expired one (and persisting the new token). Throws err.statusCode 401 if the
// account must be reconnected.
async function getValidAccessToken(gmailAccount) {
  let accessToken = decrypt(gmailAccount.access_token_enc);
  const expired =
    gmailAccount.token_expiry && new Date(gmailAccount.token_expiry) <= new Date();
  if (!expired) return accessToken;

  if (!gmailAccount.refresh_token_enc) {
    const e = new Error('Gmail token expired and no refresh token available. Please reconnect Gmail.');
    e.statusCode = 401;
    throw e;
  }
  const { OAuth2Client } = require('google-auth-library');
  const oAuth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/api/applications/gmail/callback'
  );
  oAuth2Client.setCredentials({ refresh_token: decrypt(gmailAccount.refresh_token_enc) });
  const { credentials } = await oAuth2Client.refreshAccessToken();
  accessToken = credentials.access_token;
  await db.query(
    'UPDATE gmail_accounts SET access_token_enc = $1, token_expiry = $2, updated_at = NOW() WHERE id = $3',
    [encrypt(accessToken), credentials.expiry_date ? new Date(credentials.expiry_date) : null, gmailAccount.id]
  );
  return accessToken;
}

// Pull a header value from a Gmail API message payload.
function getHeader(msg, name) {
  const h = (msg.payload?.headers || []).find(
    (x) => x.name.toLowerCase() === name.toLowerCase()
  );
  return h ? h.value : '';
}

// Extract a bare email address from a header like '"Jane" <jane@x.com>'.
function extractEmailAddress(headerValue) {
  if (!headerValue) return '';
  const m = headerValue.match(/<([^>]+)>/);
  return (m ? m[1] : headerValue).trim().toLowerCase();
}

// Decode a Gmail API base64url body part.
function decodeBase64Url(data) {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

// Recursively pull the plain-text body out of a Gmail message payload
// (used by Full mode, which fetches full message contents).
function extractPlainText(payload) {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      const text = extractPlainText(part);
      if (text) return text;
    }
  }
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return decodeBase64Url(payload.body.data).replace(/<[^>]+>/g, ' ');
  }
  return '';
}

// Full mode (Mode 3): ask Gemini to categorise a reply email.
// Returns 'interview' | 'rejection' | 'offer' | 'other' (or null on failure).
async function categorizeReply(text) {
  if (!text || !text.trim()) return null;
  try {
    const { model } = geminiService._getModel();
    const prompt = `Classify this job-application reply email into ONE category.
Reply with ONLY one word: interview, rejection, offer, or other.
- interview: invites or schedules an interview / call / next step
- rejection: declines the application
- offer: extends a job offer
- other: auto-reply, acknowledgement, or anything else

EMAIL:
${text.slice(0, 1500)}`;
    const result = await model.generateContent(prompt);
    const out = (await result.response).text().toLowerCase();
    const m = out.match(/interview|rejection|offer|other/);
    return m ? m[0] : 'other';
  } catch (err) {
    console.error('[Applications] reply categorization failed:', err.message);
    return null;
  }
}

// GET /api/applications/analytics  (must come before /:vacancyId routes)
router.get('/analytics', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE uvs.hub_status IS NULL OR uvs.hub_status = 'saved') as saved,
        COUNT(*) FILTER (WHERE uvs.hub_status = 'applied') as applied,
        COUNT(*) FILTER (WHERE uvs.hub_status = 'interviewing') as interviewing,
        COUNT(*) FILTER (WHERE uvs.hub_status = 'offered') as offered,
        COUNT(*) FILTER (WHERE uvs.hub_status = 'rejected') as rejected
       FROM user_vacancy_scores uvs
       LEFT JOIN vacancies v ON v.id = uvs.vacancy_id
       WHERE uvs.user_id = $1
         AND uvs.application_status IN ('interessant', 'toegepast')
         AND NOT EXISTS (
           SELECT 1 FROM blocked_organizations bo
           WHERE bo.user_id = $1
             AND LOWER(TRIM(COALESCE(v.company_name, ''))) = bo.company_name_normalized
         )`,
      [userId]
    );
    const row = result.rows[0];
    const total = parseInt(row.total) || 0;
    const applied = parseInt(row.applied) || 0;
    const interviewing = parseInt(row.interviewing) || 0;
    const offered = parseInt(row.offered) || 0;
    const responseRate = total > 0 ? Math.round(((interviewing + offered) / total) * 100) : 0;
    const interviewRate = applied > 0 ? Math.round((interviewing / applied) * 100) : 0;

    res.json({
      total,
      saved: parseInt(row.saved) || 0,
      applied,
      interviewing,
      offered,
      rejected: parseInt(row.rejected) || 0,
      response_rate: responseRate,
      interview_rate: interviewRate,
    });
  } catch (err) {
    console.error('[Applications] analytics error:', err.message);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

// GET /api/applications/gmail/status
// Returns every Gmail account the user has connected.
router.get('/gmail/status', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, gmail_email, is_default, tracking_mode
       FROM gmail_accounts
       WHERE user_id = $1
       ORDER BY is_default DESC, created_at ASC`,
      [req.user.id]
    );
    const accounts = result.rows.map((r) => ({
      id: r.id,
      email: r.gmail_email,
      is_default: r.is_default,
      tracking_mode: r.tracking_mode || 'manual',
    }));
    res.json({ connected: accounts.length > 0, accounts });
  } catch (err) {
    console.error('[Applications] gmail/status error:', err.message);
    res.status(500).json({ error: 'Failed to check Gmail status' });
  }
});

// GET /api/applications/gmail/connect
router.get('/gmail/connect', async (req, res) => {
  try {
    if (!isOAuthConfigured()) {
      return res.status(500).json({
        error: 'Gmail OAuth is not configured. Set a real GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the backend .env file and restart the server.',
      });
    }
    // Tracking mode chosen by the user (defaults to the privacy-safe 'manual').
    const mode = TRACKING_MODES.includes(req.query.mode) ? req.query.mode : 'manual';

    const { OAuth2Client } = require('google-auth-library');
    const redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/api/applications/gmail/callback';
    const oAuth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // force a refresh_token every time
      scope: scopesForMode(mode),
      // state carries the user id + chosen mode through the OAuth round-trip.
      state: JSON.stringify({ u: req.user.id, m: mode }),
    });
    res.json({ auth_url: authUrl });
  } catch (err) {
    console.error('[Applications] gmail/connect error:', err.message);
    res.status(500).json({ error: 'Failed to generate Gmail OAuth URL' });
  }
});

// GET /api/applications/gmail/callback
router.get('/gmail/callback', async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  try {
    const { code, error: oauthError } = req.query;

    // state carries { u: userId, m: trackingMode } as JSON.
    let userId = null;
    let mode = 'manual';
    try {
      const parsed = JSON.parse(req.query.state || '{}');
      userId = parseInt(parsed.u, 10);
      if (TRACKING_MODES.includes(parsed.m)) mode = parsed.m;
    } catch (_) {
      userId = parseInt(req.query.state, 10); // legacy plain-id state
    }

    // The user denied consent on Google's screen.
    if (oauthError) {
      return res.redirect(`${frontendUrl}/app/applications?gmail=error&reason=${encodeURIComponent(oauthError)}`);
    }
    if (!code || !userId) {
      return res.redirect(`${frontendUrl}/app/applications?gmail=error&reason=missing_code`);
    }
    if (!isOAuthConfigured()) {
      console.error('[Applications] GOOGLE_CLIENT_SECRET missing or still a placeholder — cannot complete OAuth. Set it in .env and restart the server.');
      return res.redirect(`${frontendUrl}/app/applications?gmail=error&reason=server_misconfigured`);
    }

    const { OAuth2Client } = require('google-auth-library');
    const redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/api/applications/gmail/callback';
    const oAuth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    // Resolve the connected Gmail address. Prefer the id_token (openid scope),
    // fall back to the userinfo endpoint if it is missing.
    let gmailEmail = null;
    try {
      if (tokens.id_token) {
        const ticket = await oAuth2Client.verifyIdToken({
          idToken: tokens.id_token,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        gmailEmail = ticket.getPayload()?.email || null;
      }
    } catch (_) {
      // ignore — fall through to userinfo lookup
    }
    if (!gmailEmail) {
      const infoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (infoRes.ok) {
        const info = await infoRes.json();
        gmailEmail = info.email || null;
      }
    }
    if (!gmailEmail) {
      return res.redirect(`${frontendUrl}/app/applications?gmail=error&reason=no_email`);
    }

    const accessTokenEnc = encrypt(tokens.access_token);
    const refreshTokenEnc = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;
    const tokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

    // First account a user connects becomes their default sender.
    // Reconnecting an existing account also updates its tracking_mode.
    await db.query(
      `INSERT INTO gmail_accounts (user_id, gmail_email, access_token_enc, refresh_token_enc, token_expiry, tracking_mode, is_default, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6,
         NOT EXISTS (SELECT 1 FROM gmail_accounts WHERE user_id = $1),
         NOW())
       ON CONFLICT (user_id, gmail_email) DO UPDATE SET
         access_token_enc = EXCLUDED.access_token_enc,
         refresh_token_enc = COALESCE(EXCLUDED.refresh_token_enc, gmail_accounts.refresh_token_enc),
         token_expiry = EXCLUDED.token_expiry,
         tracking_mode = EXCLUDED.tracking_mode,
         updated_at = NOW()`,
      [userId, gmailEmail, accessTokenEnc, refreshTokenEnc, tokenExpiry, mode]
    );

    res.redirect(`${frontendUrl}/app/applications?gmail=connected`);
  } catch (err) {
    console.error('[Applications] gmail/callback error:', err.message);
    res.redirect(`${frontendUrl}/app/applications?gmail=error&reason=${encodeURIComponent(err.message)}`);
  }
});

// DELETE /api/applications/gmail/:accountId
router.delete('/gmail/:accountId', async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = parseInt(req.params.accountId, 10);
    const del = await db.query(
      'DELETE FROM gmail_accounts WHERE id = $1 AND user_id = $2 RETURNING is_default',
      [accountId, userId]
    );
    if (del.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    // If the default account was removed, promote the oldest remaining one.
    if (del.rows[0].is_default) {
      await db.query(
        `UPDATE gmail_accounts SET is_default = true
         WHERE id = (
           SELECT id FROM gmail_accounts WHERE user_id = $1
           ORDER BY created_at ASC LIMIT 1
         )`,
        [userId]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[Applications] gmail delete error:', err.message);
    res.status(500).json({ error: 'Failed to disconnect Gmail' });
  }
});

// GET /api/applications
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      `SELECT
        uvs.*,
        v.id as v_id,
        v.title,
        v.company_name,
        v.source_url,
        v.contract_type,
        v.job_type,
        v.description,
        v.required_skills,
        v.location_text AS location,
        COALESCE(ec.email_count, 0) as email_count,
        COALESCE(ec.reply_count, 0) as reply_count,
        ec.last_reply_at
       FROM user_vacancy_scores uvs
       LEFT JOIN vacancies v ON v.id = uvs.vacancy_id
       LEFT JOIN (
         SELECT vacancy_id,
                COUNT(*) as email_count,
                COALESCE(SUM(reply_count), 0) as reply_count,
                MAX(last_reply_at) as last_reply_at
         FROM application_emails
         WHERE user_id = $1
         GROUP BY vacancy_id
       ) ec ON ec.vacancy_id = uvs.vacancy_id
       WHERE uvs.user_id = $1
         AND uvs.application_status IN ('interessant', 'toegepast')
         AND NOT EXISTS (
           SELECT 1 FROM blocked_organizations bo
           WHERE bo.user_id = $1
             AND LOWER(TRIM(COALESCE(v.company_name, ''))) = bo.company_name_normalized
         )
       ORDER BY uvs.updated_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[Applications] GET / error:', err.message);
    res.status(500).json({ error: 'Failed to load applications' });
  }
});

// PATCH /api/applications/:vacancyId
router.patch('/:vacancyId', async (req, res) => {
  try {
    const userId = req.user.id;
    const vacancyId = parseInt(req.params.vacancyId, 10);
    const { hub_status, notes, hub_applied_at, hub_response_at } = req.body;

    // UPSERT: create row if missing, update if exists
    const result = await db.query(
      `INSERT INTO user_vacancy_scores (user_id, vacancy_id, hub_status, notes, hub_applied_at, hub_response_at, application_status, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'interessant', NOW())
       ON CONFLICT (user_id, vacancy_id) DO UPDATE SET
         hub_status = COALESCE($3, user_vacancy_scores.hub_status),
         notes = COALESCE($4, user_vacancy_scores.notes),
         hub_applied_at = COALESCE($5, user_vacancy_scores.hub_applied_at),
         hub_response_at = COALESCE($6, user_vacancy_scores.hub_response_at),
         updated_at = NOW()
       RETURNING *`,
      [userId, vacancyId, hub_status ?? null, notes ?? null, hub_applied_at ?? null, hub_response_at ?? null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Applications] PATCH /:vacancyId error:', err.message);
    res.status(500).json({ error: 'Failed to update application' });
  }
});

// GET /api/applications/:vacancyId/emails
router.get('/:vacancyId/emails', async (req, res) => {
  try {
    const userId = req.user.id;
    const vacancyId = parseInt(req.params.vacancyId, 10);
    const result = await db.query(
      'SELECT * FROM application_emails WHERE user_id = $1 AND vacancy_id = $2 ORDER BY created_at DESC',
      [userId, vacancyId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[Applications] GET /:vacancyId/emails error:', err.message);
    res.status(500).json({ error: 'Failed to load emails' });
  }
});

// POST /api/applications/:vacancyId/emails/generate  (must come before /:emailId routes)
router.post('/:vacancyId/emails/generate', async (req, res) => {
  try {
    const userId = req.user.id;
    const vacancyId = parseInt(req.params.vacancyId, 10);
    const { email_type = 'motivation', language = 'en', rewrite_prompt, current_body, custom_context } = req.body;

    // Load vacancy
    const vacancyResult = await db.query(
      'SELECT id, title, company_name, description, required_skills, location_text AS location FROM vacancies WHERE id = $1',
      [vacancyId]
    );
    if (vacancyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Vacancy not found' });
    }
    const vacancy = vacancyResult.rows[0];

    // Load user profile
    const userResult = await db.query(
      'SELECT name, email, skills, personality, availability FROM users WHERE id = $1',
      [userId]
    );
    const user = userResult.rows[0] || {};

    // Load latest resume if exists
    let resumeText = '';
    try {
      const resumeResult = await db.query(
        'SELECT canonical_text FROM resumes WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1',
        [userId]
      );
      if (resumeResult.rows.length > 0 && resumeResult.rows[0].canonical_text) {
        resumeText = resumeResult.rows[0].canonical_text.substring(0, 2000); // Limit context size
      }
    } catch (_) {
      // resumes table may not exist, ignore
    }

    const langLabel = language === 'nl' ? 'Dutch' : 'English';

    const emailTypeDescriptions = {
      motivation: language === 'nl'
        ? `Schrijf een professionele motivatiebrief (3 paragrafen) voor de functie ${vacancy.title} bij ${vacancy.company_name}. Onderwerp: "Sollicitatie voor ${vacancy.title} bij ${vacancy.company_name}"`
        : `Write a professional motivation letter (3 paragraphs) for the ${vacancy.title} position at ${vacancy.company_name}. Subject: "Application for ${vacancy.title} at ${vacancy.company_name}"`,
      intro: language === 'nl'
        ? `Schrijf een korte professionele introductie-e-mail (2 paragrafen) voor de functie ${vacancy.title} bij ${vacancy.company_name}. Onderwerp: "Introductie - ${user.name || 'Kandidaat'}"`
        : `Write a short professional introduction email (2 paragraphs) for the ${vacancy.title} role at ${vacancy.company_name}. Subject: "Introduction - ${user.name || 'Candidate'}"`,
      follow_up: language === 'nl'
        ? `Schrijf een follow-up e-mail (1-2 paragrafen) om te informeren naar de status van de sollicitatie voor ${vacancy.title} bij ${vacancy.company_name}. Onderwerp: "Follow-up: Sollicitatie voor ${vacancy.title}"`
        : `Write a follow-up email (1-2 paragraphs) checking on the application status for ${vacancy.title} at ${vacancy.company_name}. Subject: "Follow-up: Application for ${vacancy.title}"`,
      thank_you: language === 'nl'
        ? `Schrijf een bedankmail (2 paragrafen) na een sollicitatiegesprek voor ${vacancy.title} bij ${vacancy.company_name}. Onderwerp: "Bedankt - ${vacancy.title} gesprek"`
        : `Write a thank you email (2 paragraphs) after an interview for ${vacancy.title} at ${vacancy.company_name}. Subject: "Thank you - ${vacancy.title} interview"`,
    };

    const typeInstruction = emailTypeDescriptions[email_type] || emailTypeDescriptions.motivation;

    let prompt = `You are a professional job application email writer. Write in ${langLabel}.

${typeInstruction}

CANDIDATE INFORMATION:
Name: ${user.name || 'Not provided'}
Email: ${user.email || 'Not provided'}
Skills: ${user.skills || 'Not provided'}
Personality: ${user.personality || 'Not provided'}
Availability: ${user.availability || 'Not provided'}
${resumeText ? `\nRESUME EXCERPT:\n${resumeText}` : ''}

VACANCY DETAILS:
Title: ${vacancy.title}
Company: ${vacancy.company_name}
Location: ${vacancy.location || 'Not specified'}
Required Skills: ${Array.isArray(vacancy.required_skills) ? vacancy.required_skills.join(', ') : (vacancy.required_skills || 'Not specified')}
Description: ${vacancy.description ? vacancy.description.substring(0, 1000) : 'Not provided'}

${custom_context ? `ADDITIONAL CONTEXT FROM THE CANDIDATE (incorporate this naturally and prioritise it):\n${custom_context}\n` : ''}
${rewrite_prompt ? `REWRITE INSTRUCTION: Also apply this edit instruction to the existing content: ${rewrite_prompt}\nCurrent content:\n${current_body || ''}` : ''}

Respond ONLY with a JSON object in this exact format (no markdown, no explanation):
{"subject": "...", "body": "..."}

The body should use plain text with line breaks (\\n) between paragraphs. Do not use HTML.`;

    const { model } = geminiService._getModel();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse JSON response
    let parsed;
    try {
      // Strip potential markdown code fences
      const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (_) {
      // Fallback: return raw text as body with generic subject
      const subjectMap = {
        motivation: `Application for ${vacancy.title} at ${vacancy.company_name}`,
        intro: `Introduction - ${user.name || 'Candidate'}`,
        follow_up: `Follow-up: Application for ${vacancy.title}`,
        thank_you: `Thank you - ${vacancy.title} interview`,
      };
      parsed = {
        subject: subjectMap[email_type] || `Regarding ${vacancy.title}`,
        body: text,
      };
    }

    res.json(parsed);
  } catch (err) {
    console.error('[Applications] email generate error:', err.message);
    res.status(500).json({ error: 'Failed to generate email: ' + err.message });
  }
});

// POST /api/applications/:vacancyId/emails
router.post('/:vacancyId/emails', async (req, res) => {
  try {
    const userId = req.user.id;
    const vacancyId = parseInt(req.params.vacancyId, 10);
    const { email_type = 'custom', recipient, subject, body, language = 'en' } = req.body;

    const result = await db.query(
      `INSERT INTO application_emails (user_id, vacancy_id, email_type, recipient, subject, body, language)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, vacancyId, email_type, recipient || null, subject || null, body || null, language]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Applications] POST /:vacancyId/emails error:', err.message);
    res.status(500).json({ error: 'Failed to save email' });
  }
});

// PATCH /api/applications/:vacancyId/emails/:emailId
router.patch('/:vacancyId/emails/:emailId', async (req, res) => {
  try {
    const userId = req.user.id;
    const vacancyId = parseInt(req.params.vacancyId, 10);
    const emailId = parseInt(req.params.emailId, 10);
    const { recipient, subject, body, email_type, language } = req.body;

    const result = await db.query(
      `UPDATE application_emails SET
        recipient = COALESCE($3, recipient),
        subject = COALESCE($4, subject),
        body = COALESCE($5, body),
        email_type = COALESCE($6, email_type),
        language = COALESCE($7, language),
        updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND vacancy_id = $8
       RETURNING *`,
      [emailId, userId, recipient ?? null, subject ?? null, body ?? null, email_type ?? null, language ?? null, vacancyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Applications] PATCH /:vacancyId/emails/:emailId error:', err.message);
    res.status(500).json({ error: 'Failed to update email' });
  }
});

// POST /api/applications/:vacancyId/emails/:emailId/send
router.post('/:vacancyId/emails/:emailId/send', async (req, res) => {
  try {
    const userId = req.user.id;
    const vacancyId = parseInt(req.params.vacancyId, 10);
    const emailId = parseInt(req.params.emailId, 10);
    const { gmail_account_id } = req.body || {};

    // Load email record
    const emailResult = await db.query(
      'SELECT * FROM application_emails WHERE id = $1 AND user_id = $2 AND vacancy_id = $3',
      [emailId, userId, vacancyId]
    );
    if (emailResult.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }
    const emailRecord = emailResult.rows[0];

    if (!emailRecord.recipient) {
      return res.status(400).json({ error: 'Email has no recipient' });
    }

    // Load the chosen Gmail account (or fall back to the user's default).
    const gmailResult = gmail_account_id
      ? await db.query(
          'SELECT * FROM gmail_accounts WHERE id = $1 AND user_id = $2',
          [gmail_account_id, userId]
        )
      : await db.query(
          `SELECT * FROM gmail_accounts WHERE user_id = $1
           ORDER BY is_default DESC, created_at ASC LIMIT 1`,
          [userId]
        );
    if (gmailResult.rows.length === 0) {
      return res.status(400).json({ error: 'Gmail not connected. Please connect your Gmail account first.' });
    }
    const gmailAccount = gmailResult.rows[0];

    // Get a valid access token (refreshes transparently if expired).
    let accessToken;
    try {
      accessToken = await getValidAccessToken(gmailAccount);
    } catch (err) {
      return res.status(err.statusCode || 500).json({ error: err.message });
    }

    // Use the sender's real name as the From display name — a message from
    // "Jane Doe <jane@gmail.com>" reads as human; a bare address looks automated.
    const userRow = await db.query('SELECT name FROM users WHERE id = $1', [userId]);
    const fromName = userRow.rows[0]?.name || '';

    // Build a well-formed multipart/alternative MIME message.
    const rawEmail = buildRawEmail({
      fromName,
      fromEmail: gmailAccount.gmail_email || 'me',
      to: emailRecord.recipient,
      subject: emailRecord.subject,
      body: emailRecord.body,
    });

    // Base64url encode for the Gmail API.
    const encodedEmail = Buffer.from(rawEmail, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send via Gmail REST API
    const sendResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodedEmail }),
    });

    if (!sendResponse.ok) {
      const errBody = await sendResponse.text();
      console.error('[Applications] Gmail send failed:', errBody);
      return res.status(502).json({ error: 'Failed to send via Gmail: ' + errBody });
    }

    const sendData = await sendResponse.json();

    // Update email record. gmail_account_id is recorded so reply tracking
    // later knows which mailbox owns this thread.
    await db.query(
      `UPDATE application_emails SET
        is_sent = true,
        sent_at = NOW(),
        gmail_message_id = $1,
        gmail_thread_id = $2,
        gmail_account_id = $3,
        updated_at = NOW()
       WHERE id = $4`,
      [sendData.id || null, sendData.threadId || null, gmailAccount.id, emailId]
    );

    res.json({ success: true, gmail_message_id: sendData.id, gmail_thread_id: sendData.threadId });
  } catch (err) {
    console.error('[Applications] email send error:', err.message);
    res.status(500).json({ error: 'Failed to send email: ' + err.message });
  }
});

// POST /api/applications/check-replies
// Mode 2 (lightweight tracking): for every Gmail account with tracking enabled,
// inspect ONLY the threads ApplicationHub itself sent (by stored gmail_thread_id)
// and detect inbound replies. Never scans the wider inbox.
//
// When a reply is found in a tracked thread, the matching application is auto-
// advanced to 'interviewing' (unless the user already moved it further), and a
// summary is returned so the UI can notify the user.
router.post('/check-replies', async (req, res) => {
  try {
    const userId = req.user.id;

    // Sent emails that belong to a tracking-enabled account and have a thread.
    // Skip threads checked within the last 5 minutes to avoid hammering Gmail.
    const sentRes = await db.query(
      `SELECT ae.*, ga.tracking_mode, ga.gmail_email,
              ga.access_token_enc, ga.refresh_token_enc, ga.token_expiry
         FROM application_emails ae
         JOIN gmail_accounts ga ON ga.id = ae.gmail_account_id
        WHERE ae.user_id = $1
          AND ae.is_sent = true
          AND ae.gmail_thread_id IS NOT NULL
          AND ga.tracking_mode IN ('lightweight', 'full')
          AND (ae.replies_checked_at IS NULL OR ae.replies_checked_at < NOW() - INTERVAL '5 minutes')
        ORDER BY ae.sent_at DESC
        LIMIT 40`,
      [userId]
    );

    if (sentRes.rows.length === 0) {
      return res.json({ checked: 0, new_replies: 0, updated_applications: [] });
    }

    // Cache one access token per account across its threads.
    const tokenCache = {};
    let checked = 0;
    let newReplies = 0;
    const updatedApplications = [];

    for (const email of sentRes.rows) {
      try {
        if (!tokenCache[email.gmail_account_id]) {
          tokenCache[email.gmail_account_id] = await getValidAccessToken({
            id: email.gmail_account_id,
            access_token_enc: email.access_token_enc,
            refresh_token_enc: email.refresh_token_enc,
            token_expiry: email.token_expiry,
          });
        }
        const accessToken = tokenCache[email.gmail_account_id];

        // Lightweight = headers only (minimal permission). Full = whole message
        // so Gemini can read the reply body and categorise it.
        const isFull = email.tracking_mode === 'full';
        const url =
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(email.gmail_thread_id)}` +
          (isFull ? '?format=full' : '?format=metadata&metadataHeaders=From&metadataHeaders=Date');
        const threadRes = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        checked++;
        if (!threadRes.ok) {
          // 404 = thread deleted; just mark as checked and move on.
          await db.query('UPDATE application_emails SET replies_checked_at = NOW() WHERE id = $1', [email.id]);
          continue;
        }
        const thread = await threadRes.json();
        const ourAddr = (email.gmail_email || '').toLowerCase();

        // A reply is any thread message whose From is not our own address.
        const replies = (thread.messages || []).filter((m) => {
          const from = extractEmailAddress(getHeader(m, 'From'));
          return from && from !== ourAddr;
        });

        const replyCount = replies.length;
        const last = replies[replies.length - 1];
        const lastFrom = last ? extractEmailAddress(getHeader(last, 'From')) : null;
        const lastAtRaw = last ? getHeader(last, 'Date') : null;
        const lastAt = lastAtRaw && !isNaN(Date.parse(lastAtRaw)) ? new Date(lastAtRaw) : null;

        const hadReplies = (email.reply_count || 0) > 0;
        const isNewReply = replyCount > 0 && !hadReplies;

        // Full mode: on a new reply, read the body and let Gemini categorise it.
        let category = null;
        let snippet = null;
        if (isFull && isNewReply && last) {
          const bodyText = extractPlainText(last.payload).replace(/\s+/g, ' ').trim();
          snippet = bodyText.slice(0, 500) || null;
          category = await categorizeReply(bodyText);
        }

        await db.query(
          `UPDATE application_emails SET
             reply_count = $1, last_reply_at = $2, last_reply_from = $3,
             last_reply_snippet = COALESCE($4, last_reply_snippet),
             reply_category = COALESCE($5, reply_category),
             replies_checked_at = NOW(), updated_at = NOW()
           WHERE id = $6`,
          [replyCount, lastAt, lastFrom, snippet, category, email.id]
        );

        // Newly discovered reply → notify + auto-advance the application.
        if (isNewReply) {
          newReplies++;
          // Lightweight (or uncategorised) → 'interviewing'. Full mode steers
          // the status by the AI category. Never downgrade a status the user
          // already advanced past the new one.
          let target = 'interviewing';
          let allowedFrom = ['saved', 'applied'];
          if (category === 'rejection') {
            target = 'rejected';
            allowedFrom = ['saved', 'applied', 'interviewing'];
          } else if (category === 'offer') {
            target = 'offered';
            allowedFrom = ['saved', 'applied', 'interviewing'];
          }
          const upd = await db.query(
            `UPDATE user_vacancy_scores
               SET hub_status = $3,
                   hub_response_at = COALESCE(hub_response_at, NOW()),
                   updated_at = NOW()
             WHERE user_id = $1 AND vacancy_id = $2
               AND (hub_status IS NULL OR hub_status = ANY($4))
             RETURNING vacancy_id`,
            [userId, email.vacancy_id, target, allowedFrom]
          );
          updatedApplications.push({
            vacancy_id: email.vacancy_id,
            from: lastFrom,
            category,
            new_status: upd.rows.length > 0 ? target : null,
            status_advanced: upd.rows.length > 0,
          });
        }
      } catch (innerErr) {
        console.error(`[Applications] reply check failed for email ${email.id}:`, innerErr.message);
        // don't abort the whole batch on one bad thread
      }
    }

    res.json({ checked, new_replies: newReplies, updated_applications: updatedApplications });
  } catch (err) {
    console.error('[Applications] check-replies error:', err.message);
    res.status(500).json({ error: 'Failed to check for replies' });
  }
});

module.exports = router;
