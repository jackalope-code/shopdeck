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
const {
  TOKEN_TTL_MS,
  CODE_TTL_MS,
  hashValue,
  generateVerificationToken,
  generateVerificationCode,
  getVerificationExpiry,
  sendVerificationEmail,
} = require('../lib/emailVerification');
const db = require('../db');

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
      is_demo: user.is_demo ?? false,
      account_verified: user.account_verified ?? false,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
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

function getAppBaseUrl(req) {
  return process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
}

function getOptionalAuthUserId(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
    return decoded?.id || null;
  } catch {
    return null;
  }
}

async function createUserWithProfile(client, { id, username, email, passwordHash, isDemo = false, accountVerified = false }) {
  await client.query(
    `INSERT INTO users (id, username, email, password_hash, is_demo, account_verified) VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, username, email, passwordHash, isDemo, accountVerified]
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

async function issueVerificationCredentials(client, userId) {
  const token = generateVerificationToken();
  const code = generateVerificationCode();
  const tokenHash = hashValue(token);
  const codeHash = hashValue(code);
  const { tokenExpiresAt, codeExpiresAt } = getVerificationExpiry();

  await client.query(
    'UPDATE email_verification_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL',
    [userId]
  );
  await client.query(
    'UPDATE email_verification_codes SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL',
    [userId]
  );

  await client.query(
    `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, tokenExpiresAt]
  );
  await client.query(
    `INSERT INTO email_verification_codes (user_id, code_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, codeHash, codeExpiresAt]
  );

  return { token, code };
}

async function sendUserVerificationEmail(req, { email, username, token, code }) {
  const appBaseUrl = getAppBaseUrl(req);
  const verificationLink = `${appBaseUrl.replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(token)}`;
  await sendVerificationEmail({
    to: email,
    username,
    appBaseUrl,
    verificationLink,
    code,
  });
}

async function enforceResendLimits(userId) {
  const latest = await db.query(
    `SELECT created_at
       FROM email_verification_tokens
      WHERE user_id=$1
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId]
  );
  if (latest.rows[0]) {
    const lastCreatedAt = new Date(latest.rows[0].created_at).getTime();
    if (Date.now() - lastCreatedAt < 60 * 1000) {
      const err = new Error('Please wait before requesting another verification email');
      err.statusCode = 429;
      throw err;
    }
  }

  const lastHour = await db.query(
    `SELECT COUNT(*)::int AS count
       FROM email_verification_tokens
      WHERE user_id=$1 AND created_at > NOW() - INTERVAL '1 hour'`,
    [userId]
  );
  if ((lastHour.rows[0]?.count || 0) >= 5) {
    const err = new Error('Verification resend limit reached. Try again later');
    err.statusCode = 429;
    throw err;
  }
}

function genericResendResponse() {
  return {
    ok: true,
    message: 'If the account exists and is not yet verified, a new verification email has been sent.',
  };
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ error: 'username, email, and password are required' });

    const pwCheck = validatePassword(password);
    if (!pwCheck.valid)
      return res.status(400).json({ error: pwCheck.errors[0], errors: pwCheck.errors });

    const existing = await db.query(
      'SELECT email, username FROM users WHERE email=$1 OR username=$2', [email, username]
    );
    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      return res.status(409).json({ error: row.email === email ? 'Email already in use' : 'Username already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const id = uuidv4();
    let verification;
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await createUserWithProfile(client, { id, username, email, passwordHash, accountVerified: false });
      verification = await issueVerificationCredentials(client, id);
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }

    let verificationEmailSent = true;
    try {
      await sendUserVerificationEmail(req, { email, username, token: verification.token, code: verification.code });
    } catch (mailErr) {
      verificationEmailSent = false;
      console.error('Verification email send failed:', mailErr.message);
    }

    const token = generateToken({ id, email, username, account_verified: false });
    res.status(201).json({
      token,
      user: { id, username, email, accountVerified: false },
      verification: {
        required: true,
        emailSent: verificationEmailSent,
        linkExpiresInHours: TOKEN_TTL_MS / (60 * 60 * 1000),
        codeExpiresInMinutes: CODE_TTL_MS / (60 * 1000),
      },
    });
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

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = generateToken({
      id: user.id,
      email: user.email,
      username: user.username,
      is_demo: user.is_demo,
      account_verified: user.account_verified,
    });
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        is_demo: user.is_demo,
        accountVerified: !!user.account_verified,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/verify-email?token=...
router.get('/verify-email', verifyLimiter, async (req, res) => {
  try {
    const token = String(req.query.token || '').trim();
    if (!token) return res.status(400).json({ error: 'Verification token is required' });

    const tokenHash = hashValue(token);
    const result = await db.query(
      `SELECT t.id AS token_id, t.user_id, t.expires_at, t.used_at,
              u.account_verified
         FROM email_verification_tokens t
         JOIN users u ON u.id = t.user_id
        WHERE t.token_hash = $1
        ORDER BY t.created_at DESC
        LIMIT 1`,
      [tokenHash]
    );
    const row = result.rows[0];
    if (!row) return res.status(400).json({ error: 'Invalid or expired verification token' });

    if (row.used_at || new Date(row.expires_at).getTime() <= Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    if (row.account_verified) {
      await db.query('UPDATE email_verification_tokens SET used_at=NOW() WHERE id=$1', [row.token_id]);
      return res.json({ verified: true, alreadyVerified: true });
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'UPDATE users SET account_verified=true, email_verified_at=NOW() WHERE id=$1',
        [row.user_id]
      );
      await client.query('UPDATE email_verification_tokens SET used_at=NOW() WHERE id=$1', [row.token_id]);
      await client.query(
        'UPDATE email_verification_codes SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL',
        [row.user_id]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    return res.json({ verified: true });
  } catch (err) {
    console.error('Verify email token error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/verify-email-code
router.post('/verify-email-code', verifyLimiter, async (req, res) => {
  try {
    const code = String(req.body?.code || '').trim();
    const optionalUserId = getOptionalAuthUserId(req);
    const email = optionalUserId ? null : String(req.body?.email || '').trim();

    if (!code) return res.status(400).json({ error: 'Verification code is required' });
    if (!optionalUserId && !email) return res.status(400).json({ error: 'Email is required' });

    const userResult = optionalUserId
      ? await db.query('SELECT id, account_verified FROM users WHERE id=$1', [optionalUserId])
      : await db.query('SELECT id, account_verified FROM users WHERE email=$1', [email]);
    const user = userResult.rows[0];
    if (!user) return res.status(400).json({ error: 'Invalid verification code' });
    if (user.account_verified) return res.json({ verified: true, alreadyVerified: true });

    const activeCodeResult = await db.query(
      `SELECT id, code_hash, expires_at, used_at, attempt_count
         FROM email_verification_codes
        WHERE user_id=$1
          AND used_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1`,
      [user.id]
    );
    const activeCode = activeCodeResult.rows[0];
    if (!activeCode || new Date(activeCode.expires_at).getTime() <= Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }
    if (activeCode.attempt_count >= 5) {
      return res.status(429).json({ error: 'Too many failed attempts. Request a new code' });
    }

    if (activeCode.code_hash !== hashValue(code)) {
      await db.query(
        'UPDATE email_verification_codes SET attempt_count = attempt_count + 1 WHERE id=$1',
        [activeCode.id]
      );
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE users SET account_verified=true, email_verified_at=NOW() WHERE id=$1', [user.id]);
      await client.query('UPDATE email_verification_codes SET used_at=NOW() WHERE id=$1', [activeCode.id]);
      await client.query(
        'UPDATE email_verification_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL',
        [user.id]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    return res.json({ verified: true });
  } catch (err) {
    console.error('Verify email code error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/resend-verification
router.post('/resend-verification', resendLimiter, async (req, res) => {
  try {
    const authUserId = getOptionalAuthUserId(req);
    const email = String(req.body?.email || '').trim();

    if (!authUserId && !email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const userResult = authUserId
      ? await db.query(
          'SELECT id, email, username, account_verified FROM users WHERE id=$1',
          [authUserId]
        )
      : await db.query(
          'SELECT id, email, username, account_verified FROM users WHERE email=$1',
          [email]
        );
    const user = userResult.rows[0];

    if (!user) {
      return res.json(genericResendResponse());
    }
    if (user.account_verified) {
      return res.json(authUserId ? { ok: true, alreadyVerified: true } : genericResendResponse());
    }

    await enforceResendLimits(user.id);

    let verification;
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      verification = await issueVerificationCredentials(client, user.id);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    await sendUserVerificationEmail(req, {
      email: user.email,
      username: user.username,
      token: verification.token,
      code: verification.code,
    });

    return res.json(
      authUserId
        ? {
            ok: true,
            linkExpiresInHours: TOKEN_TTL_MS / (60 * 60 * 1000),
            codeExpiresInMinutes: CODE_TTL_MS / (60 * 1000),
          }
        : genericResendResponse()
    );
  } catch (err) {
    console.error('Resend verification error:', err);
    return res.status(err.statusCode || 500).json({ error: err.message || 'Internal server error' });
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
        await createUserWithProfile(client, {
          id,
          username: 'developer',
          email: DEV_EMAIL,
          passwordHash,
          accountVerified: true,
        });
        await client.query('COMMIT');
      } catch (e) { await client.query('ROLLBACK'); throw e; }
      finally { client.release(); }
      dev = { id, username: 'developer', email: DEV_EMAIL, is_demo: false, account_verified: true };
    }

    const token = generateToken({
      id: dev.id,
      email: dev.email,
      username: dev.username,
      is_demo: false,
      account_verified: dev.account_verified ?? true,
    });
    res.json({
      token,
      user: {
        id: dev.id,
        username: dev.username,
        email: dev.email,
        is_demo: false,
        accountVerified: dev.account_verified ?? true,
      },
    });
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
      await createUserWithProfile(client, {
        id,
        username,
        email,
        passwordHash,
        isDemo: true,
        accountVerified: true,
      });
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }

    const token = generateToken({ id, email, username, is_demo: true, account_verified: true });
    res.status(201).json({ token, user: { id, username, email, is_demo: true, accountVerified: true } });
  } catch (err) {
    console.error('Demo account creation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me  (protected)
router.get('/me', verifyToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, username, email, is_demo, account_verified AS "accountVerified" FROM users WHERE id=$1',
      [req.user.id]
    );
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
      'UPDATE users SET github_token=$1, github_username=$2 WHERE id=$3',
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

module.exports = router;
