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
const db = require('../db');

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, username: user.username, is_demo: user.is_demo ?? false },
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

async function createUserWithProfile(client, { id, username, email, passwordHash, isDemo = false }) {
  await client.query(
    `INSERT INTO users (id, username, email, password_hash, is_demo) VALUES ($1,$2,$3,$4,$5)`,
    [id, username, email, passwordHash, isDemo]
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
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await createUserWithProfile(client, { id, username, email, passwordHash });
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }

    const token = generateToken({ id, email, username });
    res.status(201).json({ token, user: { id, username, email } });
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

    const token = generateToken({ id: user.id, email: user.email, username: user.username, is_demo: user.is_demo });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, is_demo: user.is_demo } });
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
        await createUserWithProfile(client, { id, username: 'developer', email: DEV_EMAIL, passwordHash });
        await client.query('COMMIT');
      } catch (e) { await client.query('ROLLBACK'); throw e; }
      finally { client.release(); }
      dev = { id, username: 'developer', email: DEV_EMAIL };
    }

    const token = generateToken({ id: dev.id, email: dev.email, username: dev.username, is_demo: false });
    res.json({ token, user: { id: dev.id, username: dev.username, email: dev.email, is_demo: false } });
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
      await createUserWithProfile(client, { id, username, email, passwordHash, isDemo: true });
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }

    const token = generateToken({ id, email, username, is_demo: true });
    res.status(201).json({ token, user: { id, username, email, is_demo: true } });
  } catch (err) {
    console.error('Demo account creation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me  (protected)
router.get('/me', verifyToken, async (req, res) => {
  try {
    const result = await db.query('SELECT id, username, email FROM users WHERE id=$1', [req.user.id]);
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
