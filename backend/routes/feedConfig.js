// backend/routes/feedConfig.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { verifyToken } = require('../middleware/auth');
const scraper = require('../scraper');

// Max 5 test-rule requests per user per minute (keyed on user ID, falls back to IP).
const testLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req),
  message: { error: 'Too many test requests — wait a minute before trying again' },
  standardHeaders: true,
  legacyHeaders: false,
});

const DEFAULTS_FILE = path.join(__dirname, '../userFeedConfig.json');
const USERS_FILE = path.join(__dirname, '../users.json');

function readUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch { return []; }
}
function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}
function readDefaults() {
  try { return JSON.parse(fs.readFileSync(DEFAULTS_FILE, 'utf8')).defaults; } catch { return {}; }
}

// GET /api/feed-config  — returns merged (defaults + user overrides)
router.get('/', verifyToken, (req, res) => {
  const users = readUsers();
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const defaults = readDefaults();
  const userCfg = user.profile?.feedConfig || {};
  // Merge: user overrides per-widget take precedence
  const merged = {};
  for (const widgetId of Object.keys(defaults)) {
    merged[widgetId] = userCfg[widgetId] ?? defaults[widgetId];
  }
  // Include any extra user-defined widget configs
  for (const widgetId of Object.keys(userCfg)) {
    if (!merged[widgetId]) merged[widgetId] = userCfg[widgetId];
  }
  res.json({ config: merged });
});

// PATCH /api/feed-config/:widgetId  — update sources/custom for one widget
router.patch('/:widgetId', verifyToken, (req, res) => {
  const { widgetId } = req.params;
  const { sources, custom } = req.body;
  const users = readUsers();
  const idx = users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });

  const feedConfig = users[idx].profile?.feedConfig || {};
  feedConfig[widgetId] = feedConfig[widgetId] || {};
  if (sources !== undefined) feedConfig[widgetId].sources = sources;
  if (custom !== undefined) feedConfig[widgetId].custom = custom;
  users[idx].profile = users[idx].profile || {};
  users[idx].profile.feedConfig = feedConfig;
  writeUsers(users);
  res.json({ config: feedConfig[widgetId] });
});

// POST /api/feed-config/test  — test a custom source rule against a URL
// Rate-limited: 5 req/min per user, plus scraper.js enforces 1-min per-host cooldown
router.post('/test', verifyToken, testLimiter, async (req, res) => {
  const { url, ruleType, selector, fieldName } = req.body;
  if (!url || !ruleType || !selector) {
    return res.status(400).json({ error: 'url, ruleType, and selector are required' });
  }
  try {
    const result = await scraper.testRule({ url, ruleType, selector, fieldName: fieldName || 'value' });
    res.json({ results: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
