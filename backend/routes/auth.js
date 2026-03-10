// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { verifyToken, JWT_SECRET } = require('../middleware/auth');
const { validatePassword } = require('../lib/passwordValidation');

const USERS_FILE = path.join(__dirname, '../users.json');

function readUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email, and password are required' });
    }
    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) {
      return res.status(400).json({ error: pwCheck.errors[0], errors: pwCheck.errors });
    }
    const users = readUsers();
    if (users.find(u => u.email === email)) {
      return res.status(409).json({ error: 'Email already in use' });
    }
    if (users.find(u => u.username === username)) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const newUser = {
      id: uuidv4(),
      username,
      email,
      passwordHash,
      createdAt: new Date().toISOString(),
      profile: {
        activeWidgets: ['inventory-stats', 'active-projects', 'recent-activity', 'keyboard-releases', 'ram-availability', 'active-deals'],
        widgetOrder: null,
        gridCols: 3,
        feedConfig: {},
        aiConfig: { provider: 'openai', model: 'gpt-4o', apiKey: '' },
      },
    };
    users.push(newUser);
    writeUsers(users);
    const token = generateToken(newUser);
    res.status(201).json({
      token,
      user: { id: newUser.id, username: newUser.username, email: newUser.email },
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
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    const users = readUsers();
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = generateToken(user);
    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/demo  — dev-only instant login as a demo account
router.post('/demo', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Demo login is not available in production' });
  }
  const DEMO_EMAIL = 'demo@shopdeck.dev';
  let users = readUsers();
  let demo = users.find(u => u.email === DEMO_EMAIL);
  if (!demo) {
    // Create demo account on first use
    const passwordHash = await bcrypt.hash('Demo@ShopDeck1!', 12);
    demo = {
      id: uuidv4(),
      username: 'demo',
      email: DEMO_EMAIL,
      passwordHash,
      isDemo: true,
      createdAt: new Date().toISOString(),
      profile: {
        activeWidgets: [
          'active-projects', 'recent-activity', 'inventory-stats', 'vendor-performance',
          'keyboard-releases', 'keycaps-tracker', 'keyboard-sales', 'keyboard-comparison',
          'ram-availability', 'gpu-availability', 'active-deals', 'electronics-watchlist',
        ],
        widgetOrder: null,
        gridCols: 3,
        feedConfig: {
          'ram-availability': {
            sources: [
              { id: 'newegg-ram', name: 'Newegg', enabled: true },
              { id: 'amazon-ram', name: 'Amazon', enabled: true },
              { id: 'tigerdirect-ram', name: 'TigerDirect', enabled: true },
              { id: 'mouser-ram', name: 'Mouser', enabled: true },
              { id: 'digikey-ram', name: 'DigiKey', enabled: true },
            ], custom: [],
          },
          'gpu-availability': {
            sources: [
              { id: 'newegg-gpu', name: 'Newegg', enabled: true },
              { id: 'amazon-gpu', name: 'Amazon', enabled: true },
              { id: 'tigerdirect-gpu', name: 'TigerDirect', enabled: true },
            ], custom: [],
          },
          'active-deals': {
            sources: [
              { id: 'amazon-deals', name: 'Amazon', enabled: true },
              { id: 'slickdeals', name: 'Slickdeals', enabled: true },
            ], custom: [],
          },
          'keyboard-releases': {
            sources: [
              { id: 'geekhack', name: 'Geekhack', enabled: true },
              { id: 'kbdfans', name: 'KBDfans', enabled: true },
              { id: 'novelkeys', name: 'Novelkeys', enabled: true },
              { id: 'stupidbulletstech', name: 'Stupid Bullets Tech', enabled: true },
              { id: 'customkeysco', name: 'Custom Keys Co.', enabled: true },
            ], custom: [],
          },
          'keyboard-sales': {
            sources: [
              { id: 'geekhack', name: 'Geekhack', enabled: true },
              { id: 'kbdfans', name: 'KBDfans', enabled: true },
              { id: 'novelkeys', name: 'Novelkeys', enabled: true },
              { id: 'stupidbulletstech', name: 'Stupid Bullets Tech', enabled: true },
              { id: 'customkeysco', name: 'Custom Keys Co.', enabled: true },
            ], custom: [],
          },
          'electronics-watchlist': {
            sources: [
              { id: 'digikey-electronics', name: 'DigiKey', enabled: true },
              { id: 'mouser-electronics', name: 'Mouser', enabled: true },
            ], custom: [],
          },
        },
        aiConfig: { provider: 'openai', model: 'gpt-4o', apiKey: '' },
      },
    };
    users.push(demo);
    writeUsers(users);
  }
  const token = generateToken(demo);
  res.json({ token, user: { id: demo.id, username: demo.username, email: demo.email } });
});

// GET /api/auth/me  (protected)
router.get('/me', verifyToken, (req, res) => {
  const users = readUsers();
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, username: user.username, email: user.email });
});

// GET /api/auth/github/status  (protected)
router.get('/github/status', verifyToken, (req, res) => {
  const users = readUsers();
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ connected: !!user.githubToken, githubUsername: user.githubUsername ?? null });
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

    // Persist token to user record
    const users = readUsers();
    const idx = users.findIndex(u => u.id === req.user.id);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });
    users[idx].githubToken    = access_token;
    users[idx].githubUsername = githubUsername;
    writeUsers(users);

    res.json({ status: 'success', githubUsername });
  } catch (err) {
    res.status(502).json({ error: err.response?.data?.error_description || err.message });
  }
});

// DELETE /api/auth/github/token  (protected)
router.delete('/github/token', verifyToken, (req, res) => {
  const users = readUsers();
  const idx = users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  delete users[idx].githubToken;
  delete users[idx].githubUsername;
  writeUsers(users);
  res.json({ ok: true });
});

module.exports = router;
