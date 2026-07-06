const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const appleSignin = require('apple-signin-auth');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db } = require('../database');
const authenticateToken = require('../middleware/auth');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Cookie configuration for httpOnly JWT
const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

// Email/Password Registration
router.post('/register', async (req, res) => {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
        return res.status(400).json({ error: 'Email, password, and name are required' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    try {
        const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'An account with this email already exists' });
        }

        const password_hash = await bcrypt.hash(password, 10);
        const result = await db.query(
            `INSERT INTO users (email, password_hash, name, auth_provider, role, subscription_plan_id, auto_applies_used)
             VALUES ($1, $2, $3, 'email', 'user', 1, 0) RETURNING *`,
            [email, password_hash, name]
        );
        const user = result.rows[0];

        const appToken = jwt.sign(
            { userId: user.id, email: user.email, role: user.role || 'user', subscription_plan_id: user.subscription_plan_id },
            JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );
        res.cookie('access_token', appToken, COOKIE_OPTIONS);
        res.status(201).json({
            user: { id: user.id, email: user.email, name: user.name, picture: user.avatar_url, role: user.role || 'user', subscription_plan_id: user.subscription_plan_id, auto_applies_used: user.auto_applies_used }
        });
    } catch (error) {
        console.error('Register Error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Email/Password Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user || !user.password_hash) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const appToken = jwt.sign(
            { userId: user.id, email: user.email, role: user.role || 'user', subscription_plan_id: user.subscription_plan_id },
            JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );
        res.cookie('access_token', appToken, COOKIE_OPTIONS);
        res.json({
            user: { id: user.id, email: user.email, name: user.name, picture: user.avatar_url, role: user.role || 'user', subscription_plan_id: user.subscription_plan_id, auto_applies_used: user.auto_applies_used }
        });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Verify Google Token and Login/Register User
router.post('/google', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ error: 'Token is required' });
    }

    try {
        // 1. Verify Google Token
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { sub: googleId, email, name, picture } = payload;

        // 2. Find or Create User
        let user = await new Promise((resolve, reject) => {
            db.query('SELECT * FROM users WHERE google_id = $1 OR email = $2', [googleId, email])
                .then(result => resolve(result.rows[0]))
                .catch(reject);
        });

        if (!user) {
            // Create new user
            // Default: role='user', subscription_plan_id=1 (Free)
            user = await new Promise((resolve, reject) => {
                db.query(
                    `INSERT INTO users (google_id, email, name, avatar_url, auth_provider, role, subscription_plan_id, auto_applies_used) 
           VALUES ($1, $2, $3, $4, 'google', 'user', 1, 0) 
           RETURNING *`,
                    [googleId, email, name, picture]
                ).then(result => resolve(result.rows[0]))
                    .catch(reject);
            });
        } else if (!user.google_id) {
            // Link existing email user to Google
            user = await new Promise((resolve, reject) => {
                db.query(
                    'UPDATE users SET google_id = $1, avatar_url = $2, auth_provider = $3 WHERE id = $4 RETURNING *',
                    [googleId, picture, 'google', user.id]
                ).then(result => resolve(result.rows[0]))
                    .catch(reject);
            });
        }

        // 3. Issue App JWT
        const appToken = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role: user.role || 'user',
                subscription_plan_id: user.subscription_plan_id
            },
            JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        // 4. Set token as httpOnly cookie — never expose in response body
        res.cookie('access_token', appToken, COOKIE_OPTIONS);

        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                picture: user.avatar_url,
                role: user.role || 'user',
                subscription_plan_id: user.subscription_plan_id,
                auto_applies_used: user.auto_applies_used
            }
        });

    } catch (error) {
        console.error('Google Auth Error:', error);
        res.status(401).json({ error: 'Authentication failed' });
    }
});

// Verify Apple Token and Login/Register User
router.post('/apple', async (req, res) => {
    const { token, user } = req.body;

    if (!token) {
        return res.status(400).json({ error: 'Token is required' });
    }

    try {
        // 1. Verify Apple Token
        const appleClientId = process.env.APPLE_CLIENT_ID;

        if (!appleClientId) {
            console.error('APPLE_CLIENT_ID not configured');
            return res.status(500).json({ error: 'Apple Sign-In not configured' });
        }

        const appleResponse = await appleSignin.verifyIdToken(token, {
            audience: appleClientId,
            ignoreExpiration: false, // Validate token expiration
        });

        const { sub: appleId, email } = appleResponse;

        // Apple may not always provide email on subsequent logins
        // Use email from the user object if provided (first-time sign-in)
        const userEmail = email || (user && user.email);
        const userName = user && user.name ? `${user.name.firstName || ''} ${user.name.lastName || ''}`.trim() : 'Apple User';

        if (!userEmail) {
            return res.status(400).json({ error: 'Email is required for registration' });
        }

        // 2. Find or Create User
        let dbUser = await new Promise((resolve, reject) => {
            db.query('SELECT * FROM users WHERE apple_id = $1 OR email = $2', [appleId, userEmail])
                .then(result => resolve(result.rows[0]))
                .catch(reject);
        });

        if (!dbUser) {
            // Create new user
            dbUser = await new Promise((resolve, reject) => {
                db.query(
                    `INSERT INTO users (apple_id, email, name, auth_provider, role, subscription_plan_id, auto_applies_used)
                     VALUES ($1, $2, $3, 'apple', 'user', 1, 0)
                     RETURNING *`,
                    [appleId, userEmail, userName]
                ).then(result => resolve(result.rows[0]))
                    .catch(reject);
            });
        } else if (!dbUser.apple_id) {
            // Link existing email user to Apple
            dbUser = await new Promise((resolve, reject) => {
                db.query(
                    'UPDATE users SET apple_id = $1, auth_provider = $2 WHERE id = $3 RETURNING *',
                    [appleId, 'apple', dbUser.id]
                ).then(result => resolve(result.rows[0]))
                    .catch(reject);
            });
        }

        // 3. Issue App JWT
        const appToken = jwt.sign(
            {
                userId: dbUser.id,
                email: dbUser.email,
                role: dbUser.role || 'user',
                subscription_plan_id: dbUser.subscription_plan_id
            },
            JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        // 4. Set token as httpOnly cookie — never expose in response body
        res.cookie('access_token', appToken, COOKIE_OPTIONS);

        res.json({
            user: {
                id: dbUser.id,
                email: dbUser.email,
                name: dbUser.name,
                picture: dbUser.avatar_url,
                role: dbUser.role || 'user',
                subscription_plan_id: dbUser.subscription_plan_id,
                auto_applies_used: dbUser.auto_applies_used
            }
        });

    } catch (error) {
        console.error('Apple Auth Error:', error);
        res.status(401).json({ error: 'Authentication failed', details: error.message });
    }
});

// Get Current User Context — returns normalized user object
router.get('/me', require('../middleware/auth'), (req, res) => {
    const user = req.user;
    res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.avatar_url || null,
        role: user.role || 'user',
        subscription_plan_id: user.subscription_plan_id,
        auto_applies_used: user.auto_applies_used
    });
});

/**
 * POST /api/auth/extension-token
 * Issue extension-compatible JWT for authenticated user
 */
router.post('/extension-token', authenticateToken, async (req, res) => {
    try {
        const user = req.user; // Set by authenticateToken

        if (!user || !user.id) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        // Fix: Read secret at runtime to guarantee match with middleware
        const RUNTIME_SECRET = process.env.JWT_SECRET || 'your-secret-key';

        // Sign new JWT specifically for extension
        const extensionToken = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                source: 'extension'
            },
            RUNTIME_SECRET,
            { expiresIn: '30d' }
        );

        console.log(`✅ Generated extension JWT for user ${user.id}`);

        res.json({
            success: true,
            token: extensionToken,
            userId: user.id
        });

    } catch (error) {
        console.error('Extension token error:', error);
        res.status(500).json({ error: 'Failed to generate token' });
    }
});

/**
 * POST /api/auth/logout
 * Clear the httpOnly cookie and end the session
 */
router.post('/logout', (req, res) => {
    res.clearCookie('access_token', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
    });
    res.json({ success: true });
});

module.exports = router;
