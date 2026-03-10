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

// In-memory result cache: { [widgetId]: { at: number, results: object } }
const feedDataCache = new Map();
const FEED_DATA_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — matches scraper scheduled cooldown

// Source-level result cache: { [sourceId]: { at: number, data: object[] } }
// Shared across all widgets so the same source is only fetched once per TTL period,
// preventing cross-widget hostname cooldown collisions (e.g. 'drops' and
// 'keyboard-releases' both reference 'cannonkeys-keyboards').
const sourceResultCache = new Map();

// GET /api/feed-config/data/:widgetId  — scrape enabled built-in + custom sources for a widget
router.get('/data/:widgetId', verifyToken, async (req, res) => {
  const { widgetId } = req.params;

  // Serve cached result if still fresh
  const cached = feedDataCache.get(widgetId);
  if (cached && (Date.now() - cached.at) < FEED_DATA_CACHE_TTL_MS) {
    return res.json({ sources: cached.results, at: new Date(cached.at).toISOString(), cached: true });
  }

  const users = readUsers();
  const user = users.find(u => u.id === req.user.id);
  const defaults = readDefaults();

  const widgetCfg = user?.profile?.feedConfig?.[widgetId] ?? defaults[widgetId] ?? {};
  const sources = widgetCfg.sources ?? [];
  const custom  = widgetCfg.custom  ?? [];

  const results = {};

  // Run enabled built-in sources — reuse source-level cache when available
  for (const src of sources.filter(s => s.enabled)) {
    const rule = scraper.BUILTIN_SOURCE_RULES[src.id];
    if (!rule) continue;
    const cachedSrc = sourceResultCache.get(src.id);
    if (cachedSrc && (Date.now() - cachedSrc.at) < FEED_DATA_CACHE_TTL_MS) {
      results[src.id] = { name: src.name, data: cachedSrc.data, error: null };
      continue;
    }
    try {
      const data = await scraper.runSource(rule, 'scheduled');
      sourceResultCache.set(src.id, { at: Date.now(), data });
      results[src.id] = { name: src.name, data, error: null };
    } catch (err) {
      results[src.id] = { name: src.name, data: [], error: err.message };
    }
  }

  // Run enabled custom rules
  for (const rule of custom) {
    try {
      const data = await scraper.runSource(rule, 'scheduled');
      results[`custom:${rule.name}`] = { name: rule.name, data, error: null };
    } catch (err) {
      results[`custom:${rule.name}`] = { name: rule.name, data: [], error: err.message };
    }
  }

  // Cache and respond
  feedDataCache.set(widgetId, { at: Date.now(), results });
  res.json({ sources: results, at: new Date().toISOString(), cached: false });
});

module.exports = router;
