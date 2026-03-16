// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const { verifyToken, JWT_SECRET } = require('../middleware/auth');
const { encryptToken } = require('../lib/tokenCrypto');
const { validatePassword } = require('../lib/passwordValidation');
const { sendVerificationEmail, sendEmailChangeVerification } = require('../lib/emailService');
const { OAuth2Client } = require('google-auth-library');
const db = require('../db');

const googleClient = process.env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  : null;

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
      is_demo: user.is_demo ?? false,
      email_verified: user.email_verified ?? false,
      has_password: user.has_password ?? true,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function autoUsername() {
  return 'user_' + crypto.randomBytes(4).toString('hex');
}

async function sendVerificationToken(userId, email, frontendUrl) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.query(
    `INSERT INTO email_tokens (user_id, token, type, expires_at) VALUES ($1,$2,'verification',$3)`,
    [userId, token, expires]
  );
  const verifyUrl = `${frontendUrl}/verify-email?token=${token}`;
  sendVerificationEmail(email, verifyUrl).catch(err => console.error('Email send error:', err));
}

const demoCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many demo accounts created from this IP. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many verification attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const resendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many resend attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const DEFAULT_ACTIVE_WIDGETS = [
  'active-projects', 'recent-activity', 'inventory-stats', 'vendor-performance',
  'keyboard-releases', 'keycaps-tracker', 'keyboard-sales', 'keyboard-comparison',
  'ram-availability', 'gpu-availability', 'active-deals', 'electronics-watchlist',
];

const DEFAULT_FEED_CONFIG = {
  'ram-availability': {
    sources: [
      { id: 'newegg-ram',      name: 'Newegg',          enabled: true },
      { id: 'amazon-ram',      name: 'Amazon',          enabled: false },
      { id: 'microcenter-ram', name: 'Microcenter',     enabled: false },
      { id: 'reddit-ram',      name: 'r/buildapcsales', enabled: true },
      { id: 'camelcamel-ram',  name: 'CamelCamelCamel', enabled: false },
    ], custom: [],
  },
  'gpu-availability': {
    sources: [
      { id: 'newegg-gpu',      name: 'Newegg',          enabled: true },
      { id: 'amazon-gpu',      name: 'Amazon',          enabled: false },
      { id: 'microcenter-gpu', name: 'Microcenter',     enabled: false },
      { id: 'reddit-gpu',      name: 'r/buildapcsales', enabled: true },
      { id: 'camelcamel-gpu',  name: 'CamelCamelCamel', enabled: false },
    ], custom: [],
  },
  'active-deals': {
    sources: [
      { id: 'amazon-deals', name: 'Amazon',     enabled: true },
      { id: 'slickdeals',   name: 'Slickdeals', enabled: true },
    ], custom: [],
  },
  'keyboard-releases': {
    sources: [
      { id: 'novelkeys-keyboards',         name: 'NovelKeys',           enabled: true },
      { id: 'kbdfans-keyboards',           name: 'KBDfans',             enabled: true },
      { id: 'keeb-io-keyboards',           name: 'Keeb.io',             enabled: true },
      { id: 'stupidbulletstech-keyboards', name: 'Stupid Bullets Tech', enabled: true },
      { id: 'customkeysco-keyboards',      name: 'Custom Keys Co.',     enabled: true },
    ], custom: [],
  },
  'keyboard-sales': {
    sources: [
      { id: 'novelkeys-keyboards',          name: 'NovelKeys',           enabled: true },
      { id: 'kbdfans-keyboards',            name: 'KBDfans',             enabled: true },
      { id: 'keeb-io-keyboards',            name: 'Keeb.io',             enabled: true },
      { id: 'stupidbulletstech-keyboards',  name: 'Stupid Bullets Tech', enabled: true },
      { id: 'stupidbulletstech-garage-sale',name: 'Stupid Bullets Tech', enabled: true },
      { id: 'customkeysco-keyboards',       name: 'Custom Keys Co.',     enabled: true },
    ], custom: [],
  },
  'keyboard-full-release': {
    sources: [
      { id: 'novelkeys-keyboards',         name: 'NovelKeys',           enabled: true },
      { id: 'kbdfans-keyboards',           name: 'KBDfans',             enabled: true },
      { id: 'keeb-io-keyboards',           name: 'Keeb.io',             enabled: true },
      { id: 'stupidbulletstech-keyboards', name: 'Stupid Bullets Tech', enabled: true },
      { id: 'customkeysco-keyboards',      name: 'Custom Keys Co.',     enabled: true },
    ], custom: [],
  },
  'keyboard-parts-release': {
    sources: [
      { id: 'novelkeys-keyboards',          name: 'NovelKeys',           enabled: true },
      { id: 'kbdfans-keyboards',            name: 'KBDfans',             enabled: true },
      { id: 'keeb-io-keyboards',            name: 'Keeb.io',             enabled: true },
      { id: 'stupidbulletstech-keyboards',  name: 'Stupid Bullets Tech', enabled: true },
      { id: 'stupidbulletstech-accessories',name: 'Stupid Bullets Tech', enabled: true },
      { id: 'customkeysco-keyboards',       name: 'Custom Keys Co.',     enabled: true },
    ], custom: [],
  },
  'keyboard-switches': {
    sources: [
      { id: 'novelkeys-switches',          name: 'NovelKeys',           enabled: true },
      { id: 'cannonkeys-switches',         name: 'CannonKeys',          enabled: true },
      { id: 'stupidbulletstech-switches',  name: 'Stupid Bullets Tech', enabled: true },
      { id: 'customkeysco-switches',       name: 'Custom Keys Co.',     enabled: true },
    ], custom: [],
  },
  'keyboard-accessories': {
    sources: [
      { id: 'stupidbulletstech-accessories', name: 'Stupid Bullets Tech', enabled: true },
      { id: 'customkeysco-switches',         name: 'Custom Keys Co.',     enabled: true },
      { id: 'customkeysco-keyboards',        name: 'Custom Keys Co.',     enabled: true },
    ], custom: [],
  },
  'electronics-watchlist': {
    sources: [
      { id: 'adafruit-new',              name: 'Adafruit New Products',    enabled: true },
      { id: 'adafruit-microcontrollers', name: 'Adafruit Microcontrollers', enabled: true },
      { id: 'adafruit-sensors',          name: 'Adafruit Sensors',          enabled: true },
      { id: 'adafruit-motors',           name: 'Adafruit Motors',           enabled: true },
      { id: 'adafruit-passives',         name: 'Adafruit Passives',         enabled: true },
      { id: 'adafruit-breakout-boards',  name: 'Adafruit Breakout Boards',  enabled: true },
      { id: 'mouser-electronics',        name: 'Mouser Electronics',        ruleType: 'mouser-api',  keywords: 'development board', enabled: true },
      { id: 'microcenter-electronics',   name: 'Microcenter',               enabled: true },
    ], custom: [],
  },
};

async function createUserWithProfile(client, { id, username, email, passwordHash, isDemo = false, emailVerified = false, hasPassword = true }) {
  await client.query(
    `INSERT INTO users (id, username, email, password_hash, is_demo, email_verified, has_password) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, username, email, passwordHash, isDemo, emailVerified, hasPassword]
  );
  await client.query(
    `INSERT INTO user_profiles (user_id, active_widgets, grid_cols, feed_config, ai_config)
     VALUES ($1,$2,$3,$4,$5)`,
    [
      id,
      JSON.stringify(DEFAULT_ACTIVE_WIDGETS),
      3,
      JSON.stringify(DEFAULT_FEED_CONFIG),
      JSON.stringify({ provider: 'openai', model: 'gpt-4o', apiKey: '' }),
    ]
  );
  await client.query(`INSERT INTO ai_history      (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [id]);
  await client.query(`INSERT INTO tracked_alerts  (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [id]);
  await client.query(`INSERT INTO alert_history   (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [id]);
  await client.query(`INSERT INTO user_watchlists (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [id]);
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'email and password are required' });

    const pwCheck = validatePassword(password);
    if (!pwCheck.valid)
      return res.status(400).json({ error: pwCheck.errors[0], errors: pwCheck.errors });

    const existing = await db.query('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.rows.length > 0)
      return res.status(409).json({ error: 'Email already in use' });

    const passwordHash = await bcrypt.hash(password, 12);
    const id = uuidv4();
    let username = autoUsername();
    // Ensure auto-generated username doesn't collide (extremely unlikely but safe)
    while ((await db.query('SELECT id FROM users WHERE username=$1', [username])).rows.length > 0) {
      username = autoUsername();
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await createUserWithProfile(client, { id, username, email, passwordHash, emailVerified: false, hasPassword: true });
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }

    // Send verification email non-blocking
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    sendVerificationToken(id, email, frontendUrl);

    const token = generateToken({ id, email, username, is_demo: false, email_verified: false, has_password: true });
    res.status(201).json({ token, user: { id, username, email, email_verified: false, has_password: true } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'email and password are required' });

    const result = await db.query('SELECT * FROM users WHERE email=$1', [email]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    if (!user.has_password)
      return res.status(400).json({ error: 'This account was created with OAuth. Use the OAuth provider to sign in, or set a password in Settings.' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    if (process.env.REQUIRE_EMAIL_VERIFICATION === 'true' && !user.email_verified) {
      return res.status(403).json({ error: 'Please verify your email before signing in. Check your inbox for a verification link.', code: 'EMAIL_NOT_VERIFIED' });
    }

    const token = generateToken(user);
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, is_demo: user.is_demo, email_verified: user.email_verified, has_password: user.has_password } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// POST /api/auth/developer  — dev-only instant login as the developer account
router.post('/developer', async (req, res) => {
  if (process.env.NODE_ENV === 'production')
    return res.status(403).json({ error: 'Developer login is not available in production' });

  const DEV_EMAIL = 'developer@shopdeck.dev';
  try {
    let result = await db.query('SELECT * FROM users WHERE email=$1', [DEV_EMAIL]);
    let dev = result.rows[0];

    if (!dev) {
      const passwordHash = await bcrypt.hash('Dev@ShopDeck1!', 12);
      const id = uuidv4();
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        await createUserWithProfile(client, { id, username: 'developer', email: DEV_EMAIL, passwordHash, emailVerified: true, hasPassword: true });
        await client.query('COMMIT');
      } catch (e) { await client.query('ROLLBACK'); throw e; }
      finally { client.release(); }
      dev = { id, username: 'developer', email: DEV_EMAIL, email_verified: true, has_password: true };
    }

    const token = generateToken({ id: dev.id, email: dev.email, username: dev.username, is_demo: false, email_verified: dev.email_verified ?? true, has_password: dev.has_password ?? true });
    res.json({ token, user: { id: dev.id, username: dev.username, email: dev.email, is_demo: false, email_verified: dev.email_verified ?? true, has_password: dev.has_password ?? true } });
  } catch (err) {
    console.error('Developer login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/demo  — creates a unique demo account, no credentials required
router.post('/demo', demoCreateLimiter, async (req, res) => {
  try {
    const suffix = crypto.randomBytes(4).toString('hex');
    const username = `demo_${suffix}`;
    const email = `${username}@demo.shopdeck.internal`;
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
    const id = uuidv4();
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await createUserWithProfile(client, { id, username, email, passwordHash, isDemo: true, emailVerified: true, hasPassword: true });
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }

    const token = generateToken({ id, email, username, is_demo: true, email_verified: true, has_password: true });
    res.status(201).json({ token, user: { id, username, email, is_demo: true, email_verified: true, has_password: true } });
  } catch (err) {
    console.error('Demo account creation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/upgrade  (protected — demo only)
router.post('/upgrade', verifyToken, async (req, res) => {
  if (!req.user.is_demo) return res.status(400).json({ error: 'Account is not a demo account' });
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'username, email, and password are required' });
  const pwCheck = validatePassword(password);
  if (!pwCheck.valid) return res.status(400).json({ error: pwCheck.errors[0], errors: pwCheck.errors });
  try {
    const [existingUser, existingEmail] = await Promise.all([
      db.query('SELECT id FROM users WHERE username=$1 AND id!=$2', [username, req.user.id]),
      db.query('SELECT id FROM users WHERE email=$1 AND id!=$2', [email, req.user.id]),
    ]);
    if (existingUser.rows.length > 0) return res.status(409).json({ error: 'Username is already taken' });
    if (existingEmail.rows.length > 0) return res.status(409).json({ error: 'Email is already registered' });
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await db.query(
      'UPDATE users SET username=$1, email=$2, password_hash=$3, is_demo=false WHERE id=$4 RETURNING id, username, email',
      [username, email, passwordHash, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    const user = result.rows[0];
    const token = generateToken({ id: user.id, email: user.email, username: user.username, is_demo: false, email_verified: false, has_password: true });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, is_demo: false, email_verified: false, has_password: true } });
  } catch (err) {
    console.error('Upgrade error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me  (protected)
router.get('/me', verifyToken, async (req, res) => {
  try {
    const result = await db.query('SELECT id, username, email, email_verified, has_password, google_id FROM users WHERE id=$1', [req.user.id]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/auth/github/status  (protected)
router.get('/github/status', verifyToken, async (req, res) => {
  try {
    const result = await db.query('SELECT github_token, github_username FROM users WHERE id=$1', [req.user.id]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ connected: !!user.github_token, githubUsername: user.github_username ?? null });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/auth/github/device/start  — proxies GitHub Device Flow initiation (no auth needed)
router.post('/github/device/start', async (req, res) => {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'GITHUB_OAUTH_CLIENT_ID is not set. Create a GitHub OAuth App and add it to backend/.env' });
  }
  try {
    const r = await axios.post(
      'https://github.com/login/device/code',
      { client_id: clientId, scope: 'user:email' },
      { headers: { Accept: 'application/json' }, timeout: 10_000 }
    );
    res.json(r.data);
  } catch (err) {
    res.status(502).json({ error: err.response?.data?.error_description || err.message });
  }
});

// POST /api/auth/github/device/poll  (protected — stores token on success)
router.post('/github/device/poll', verifyToken, async (req, res) => {
  const { device_code } = req.body;
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: 'GITHUB_OAUTH_CLIENT_ID not configured' });
  if (!device_code) return res.status(400).json({ error: 'device_code required' });

  try {
    const r = await axios.post(
      'https://github.com/login/oauth/access_token',
      { client_id: clientId, device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' },
      { headers: { Accept: 'application/json' }, timeout: 10_000 }
    );
    const { access_token, error: ghErr, error_description } = r.data;

    if (ghErr === 'authorization_pending') return res.json({ status: 'pending' });
    if (ghErr === 'slow_down')             return res.json({ status: 'slow_down' });
    if (ghErr === 'expired_token')         return res.json({ status: 'expired', error: 'Code expired. Please start over.' });
    if (ghErr)                             return res.json({ status: 'error', error: error_description || ghErr });
    if (!access_token)                     return res.json({ status: 'pending' });

    // Resolve GitHub username
    let githubUsername = null;
    try {
      const ghUser = await axios.get('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${access_token}`, 'User-Agent': 'ShopDeck' },
        timeout: 8_000,
      });
      githubUsername = ghUser.data.login ?? null;
    } catch { /* non-fatal */ }

    await db.query(
      'UPDATE users SET github_token=$1, github_username=$2, email_verified=true WHERE id=$3',
      [encryptToken(access_token), githubUsername, req.user.id]
    );
    res.json({ status: 'success', githubUsername });
  } catch (err) {
    res.status(502).json({ error: err.response?.data?.error_description || err.message });
  }
});

// DELETE /api/auth/github/token  (protected)
router.delete('/github/token', verifyToken, async (req, res) => {
  try {
    await db.query('UPDATE users SET github_token=NULL, github_username=NULL WHERE id=$1', [req.user.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// ─── GitHub Device Flow Sign-in (unauthenticated) ─────────────────────────────
// POST /api/auth/github/device/signin  — exchanges device_code for access token,
// then finds or creates a user by GitHub email / username, and issues a JWT.
router.post('/github/device/signin', async (req, res) => {
  const { device_code } = req.body;
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: 'GITHUB_OAUTH_CLIENT_ID not configured' });
  if (!device_code) return res.status(400).json({ error: 'device_code required' });

  try {
    const r = await axios.post(
      'https://github.com/login/oauth/access_token',
      { client_id: clientId, device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' },
      { headers: { Accept: 'application/json' }, timeout: 10_000 }
    );
    const { access_token, error: ghErr, error_description } = r.data;

    if (ghErr === 'authorization_pending') return res.json({ status: 'pending' });
    if (ghErr === 'slow_down')             return res.json({ status: 'slow_down' });
    if (ghErr === 'expired_token')         return res.json({ status: 'expired', error: 'Code expired. Please start over.' });
    if (ghErr)                             return res.json({ status: 'error', error: error_description || ghErr });
    if (!access_token)                     return res.json({ status: 'pending' });

    // Fetch GitHub user profile + primary email
    const ghUser = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${access_token}`, 'User-Agent': 'ShopDeck' },
      timeout: 8_000,
    });
    const githubUsername = ghUser.data.login;

    let primaryEmail = null;
    try {
      const ghEmails = await axios.get('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${access_token}`, 'User-Agent': 'ShopDeck' },
        timeout: 8_000,
      });
      const primary = ghEmails.data.find(e => e.primary && e.verified);
      primaryEmail = primary?.email ?? null;
    } catch { /* non-fatal */ }

    // Find existing user by github_username or email
    let user = null;
    const byGhUsername = await db.query('SELECT * FROM users WHERE github_username=$1', [githubUsername]);
    if (byGhUsername.rows.length > 0) {
      user = byGhUsername.rows[0];
    } else if (primaryEmail) {
      const byEmail = await db.query('SELECT * FROM users WHERE email=$1', [primaryEmail]);
      if (byEmail.rows.length > 0) user = byEmail.rows[0];
    }

    const isNewUser = !user;
    if (!user) {
      const id = uuidv4();
      let username = githubUsername || autoUsername();
      while ((await db.query('SELECT id FROM users WHERE username=$1', [username])).rows.length > 0) {
        username = autoUsername();
      }
      const email = primaryEmail || `${githubUsername}@github.shopdeck.internal`;
      const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        await createUserWithProfile(client, { id, username, email, passwordHash, emailVerified: true, hasPassword: false });
        await client.query('COMMIT');
      } catch (e) { await client.query('ROLLBACK'); throw e; }
      finally { client.release(); }
      await db.query(
        'UPDATE users SET github_token=$1, github_username=$2 WHERE id=$3',
        [encryptToken(access_token), githubUsername, id]
      );
      user = { id, username, email, is_demo: false, email_verified: true, has_password: false };
    } else {
      // Update stored token and ensure email_verified=true for existing user
      await db.query(
        'UPDATE users SET github_token=$1, github_username=$2, email_verified=true WHERE id=$3',
        [encryptToken(access_token), githubUsername, user.id]
      );
      user.email_verified = true;
    }

    const token = generateToken(user);
    res.json({ status: 'success', token, user: { id: user.id, username: user.username, email: user.email, is_demo: user.is_demo, email_verified: user.email_verified, has_password: user.has_password }, isNewUser });
  } catch (err) {
    res.status(502).json({ error: err.response?.data?.error_description || err.message });
  }
});

// ─── Google ID-token sign-in (unauthenticated) ────────────────────────────────
const googleSigninLimiter = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false });

// POST /api/auth/google  — verifies Google ID token, finds or creates user
router.post('/google', googleSigninLimiter, async (req, res) => {
  if (!googleClient) return res.status(503).json({ error: 'Google OAuth is not configured on this server' });
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'credential required' });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const googleId = payload.sub;
    const email    = payload.email;
    const emailVerified = payload.email_verified ?? false;

    // Find by google_id first, then by email
    let user = null;
    const byGoogleId = await db.query('SELECT * FROM users WHERE google_id=$1', [googleId]);
    if (byGoogleId.rows.length > 0) {
      user = byGoogleId.rows[0];
    } else if (email) {
      const byEmail = await db.query('SELECT * FROM users WHERE email=$1', [email]);
      if (byEmail.rows.length > 0) {
        user = byEmail.rows[0];
        // Link google_id to existing account
        await db.query('UPDATE users SET google_id=$1 WHERE id=$2', [googleId, user.id]);
      }
    }

    const isNewUser = !user;
    if (!user) {
      const id = uuidv4();
      let username = autoUsername();
      while ((await db.query('SELECT id FROM users WHERE username=$1', [username])).rows.length > 0) {
        username = autoUsername();
      }
      const userEmail = email || `${googleId}@google.shopdeck.internal`;
      const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        await createUserWithProfile(client, { id, username, email: userEmail, passwordHash, emailVerified: emailVerified, hasPassword: false });
        await client.query('COMMIT');
      } catch (e) { await client.query('ROLLBACK'); throw e; }
      finally { client.release(); }
      await db.query('UPDATE users SET google_id=$1 WHERE id=$2', [googleId, id]);
      user = { id, username, email: userEmail, is_demo: false, email_verified: emailVerified, has_password: false };
    } else {
      if (emailVerified) {
        await db.query('UPDATE users SET email_verified=true WHERE id=$1', [user.id]);
        user.email_verified = true;
      }
    }

    const token = generateToken(user);
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, is_demo: user.is_demo, email_verified: user.email_verified, has_password: user.has_password }, isNewUser });
  } catch (err) {
    console.error('Google signin error:', err);
    res.status(401).json({ error: 'Invalid Google credential' });
  }
});

// POST /api/auth/google/link  (protected) — link Google account to current user
router.post('/google/link', verifyToken, async (req, res) => {
  if (!googleClient) return res.status(503).json({ error: 'Google OAuth is not configured on this server' });
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'credential required' });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const googleId = ticket.getPayload().sub;

    const conflict = await db.query('SELECT id FROM users WHERE google_id=$1 AND id!=$2', [googleId, req.user.id]);
    if (conflict.rows.length > 0)
      return res.status(409).json({ error: 'This Google account is already linked to another ShopDeck account.' });

    await db.query('UPDATE users SET google_id=$1 WHERE id=$2', [googleId, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Google link error:', err);
    res.status(401).json({ error: 'Invalid Google credential' });
  }
});

// DELETE /api/auth/google/link  (protected) — unlink Google account
router.delete('/google/link', verifyToken, async (req, res) => {
  try {
    await db.query('UPDATE users SET google_id=NULL WHERE id=$1', [req.user.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// ─── Email verification ────────────────────────────────────────────────────────
// GET /api/auth/verify-email?token=  — verifies any email token (verification or change)
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'token required' });

  try {
    const result = await db.query(
      `SELECT * FROM email_tokens WHERE token=$1 AND used_at IS NULL AND expires_at > NOW()`,
      [token]
    );
    const row = result.rows[0];
    if (!row) return res.status(400).json({ error: 'Invalid or expired token', code: 'TOKEN_INVALID' });

    await db.query('UPDATE email_tokens SET used_at=NOW() WHERE id=$1', [row.id]);

    if (row.type === 'email_change') {
      const newEmail = row.metadata?.new_email;
      if (!newEmail) return res.status(400).json({ error: 'Malformed token' });
      const conflict = await db.query('SELECT id FROM users WHERE email=$1 AND id!=$2', [newEmail, row.user_id]);
      if (conflict.rows.length > 0) return res.status(409).json({ error: 'That email address is already in use.' });
      await db.query('UPDATE users SET email=$1, email_verified=true WHERE id=$2', [newEmail, row.user_id]);
      return res.json({ ok: true, type: 'email_change' });
    }

    // type === 'verification'
    await db.query('UPDATE users SET email_verified=true WHERE id=$1', [row.user_id]);
    res.json({ ok: true, type: 'verification' });
  } catch (err) {
    console.error('Verify email error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const resendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: req => req.user?.id ?? req.ip,
  message: { error: 'Too many verification emails sent. Please wait an hour before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/auth/resend-verification  (protected)
router.post('/resend-verification', verifyToken, resendLimiter, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.is_demo) return res.status(400).json({ error: 'Demo accounts do not have email verification.' });
    if (user.email_verified) return res.status(400).json({ error: 'Email is already verified.' });

    // Delete previous unused verification tokens for this user
    await db.query(`DELETE FROM email_tokens WHERE user_id=$1 AND type='verification' AND used_at IS NULL`, [user.id]);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    await sendVerificationToken(user.id, user.email, frontendUrl);
    res.json({ ok: true });
  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/change-email  (protected)
router.post('/change-email', verifyToken, async (req, res) => {
  if (req.user.is_demo) return res.status(403).json({ error: 'Demo accounts cannot change email.' });
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });

  try {
    const conflict = await db.query('SELECT id FROM users WHERE email=$1 AND id!=$2', [email, req.user.id]);
    if (conflict.rows.length > 0) return res.status(409).json({ error: 'That email address is already in use.' });

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.query(
      `INSERT INTO email_tokens (user_id, token, type, metadata, expires_at) VALUES ($1,$2,'email_change',$3,$4)`,
      [req.user.id, token, JSON.stringify({ new_email: email }), expires]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const verifyUrl = `${frontendUrl}/verify-email?token=${token}`;
    sendEmailChangeVerification(email, verifyUrl).catch(err => console.error('Email send error:', err));

    res.json({ ok: true });
  } catch (err) {
    console.error('Change email error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/set-password  (protected) — for OAuth-only accounts adding a password
router.post('/set-password', verifyToken, async (req, res) => {
  if (req.user.is_demo) return res.status(403).json({ error: 'Demo accounts cannot set a password.' });

  const result = await db.query('SELECT has_password FROM users WHERE id=$1', [req.user.id]);
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.has_password) return res.status(400).json({ error: 'Account already has a password. Use the change-password flow instead.' });

  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'password required' });

  const pwCheck = validatePassword(password);
  if (!pwCheck.valid) return res.status(400).json({ error: pwCheck.errors[0], errors: pwCheck.errors });

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const updated = await db.query(
      'UPDATE users SET password_hash=$1, has_password=true WHERE id=$2 RETURNING id, username, email, is_demo, email_verified',
      [passwordHash, req.user.id]
    );
    const u = updated.rows[0];
    const token = generateToken({ ...u, has_password: true });
    res.json({ token, user: { id: u.id, username: u.username, email: u.email, is_demo: u.is_demo, email_verified: u.email_verified, has_password: true } });
  } catch (err) {
    console.error('Set password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
