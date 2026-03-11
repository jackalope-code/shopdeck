// backend/routes/feedConfig.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { verifyToken } = require('../middleware/auth');
const { demoGuard } = require('../middleware/demoGuard');
const scraper = require('../scraper');
const db = require('../db');
const redis = require('../redis');

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

function readDefaults() {
  try { return JSON.parse(fs.readFileSync(DEFAULTS_FILE, 'utf8')).defaults; } catch { return {}; }
}

// Redis TTL for scrape cache — matches scheduled cooldown in scraper.js
const FEED_DATA_CACHE_TTL_S  = 6 * 60 * 60;  // 6 hours (seconds for Redis EX)
const FEED_DATA_CACHE_TTL_MS = FEED_DATA_CACHE_TTL_S * 1000;

// Fallback in-process Maps (used if Redis is unavailable)
const localFeedCache   = new Map();
const localSourceCache = new Map();

// In-flight promise coalescing — prevents multiple concurrent requests from each
// triggering a separate scrape for the same source when the cache is cold.
const inFlightScrapes = new Map(); // sourceId → Promise<{data, entry}>

// Max 10 data-fetch requests per user per minute to prevent cache-bypass hammering.
const dataLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req),
  message: { error: 'Too many feed requests — slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

async function rGet(key) {
  try { return await redis.get(key); } catch { return null; }
}
async function rSet(key, value, ttlSeconds) {
  try { await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds); } catch { /* degraded */ }
}
async function rGetJson(key) {
  const raw = await rGet(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// GET /api/feed-config  — returns merged (defaults + user overrides)
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await db.query('SELECT feed_config FROM user_profiles WHERE user_id=$1', [req.user.id]);
    const userCfg = result.rows[0]?.feed_config ?? {};
    const defaults = readDefaults();
    const merged = {};
    for (const widgetId of Object.keys(defaults)) {
      merged[widgetId] = userCfg[widgetId] ?? defaults[widgetId];
    }
    for (const widgetId of Object.keys(userCfg)) {
      if (!merged[widgetId]) merged[widgetId] = userCfg[widgetId];
    }
    res.json({ config: merged });
  } catch (err) {
    console.error('GET /feed-config error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/feed-config/:widgetId  — update sources/custom for one widget
router.patch('/:widgetId', verifyToken, demoGuard, async (req, res) => {
  const { widgetId } = req.params;
  const { sources, custom } = req.body;
  try {
    const result = await db.query('SELECT feed_config FROM user_profiles WHERE user_id=$1', [req.user.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Profile not found' });
    const feedConfig = result.rows[0].feed_config ?? {};
    feedConfig[widgetId] = feedConfig[widgetId] ?? {};
    if (sources !== undefined) feedConfig[widgetId].sources = sources;
    if (custom  !== undefined) feedConfig[widgetId].custom  = custom;
    await db.query(
      `UPDATE user_profiles SET feed_config=$1, updated_at=NOW() WHERE user_id=$2`,
      [JSON.stringify(feedConfig), req.user.id]
    );
    res.json({ config: feedConfig[widgetId] });
  } catch (err) {
    console.error('PATCH /feed-config error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/feed-config/test  — test a custom source rule against a URL
// Rate-limited: 5 req/min per user, plus scraper.js enforces 1-min per-host cooldown
router.post('/test', verifyToken, demoGuard, testLimiter, async (req, res) => {
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

// GET /api/feed-config/data/:widgetId  — scrape enabled built-in + custom sources for a widget
router.get('/data/:widgetId', verifyToken, dataLimiter, async (req, res) => {
  const { widgetId } = req.params;
  const cacheKey = `feed:widget:${req.user.id}:${widgetId}`;
  const localKey  = `${req.user.id}:${widgetId}`;

  // Serve Redis-cached result if still fresh
  const cachedRaw = await rGetJson(cacheKey);
  if (cachedRaw) {
    console.log(`[cache] HIT  redis  ${cacheKey}`);
    return res.json({ sources: cachedRaw.results, at: cachedRaw.at, cached: true });
  }
  // Fallback: in-process Map (Redis unavailable)
  const localCached = localFeedCache.get(localKey);
  if (localCached && (Date.now() - localCached.at) < FEED_DATA_CACHE_TTL_MS) {
    console.log(`[cache] HIT  local  ${localKey}`);
    return res.json({ sources: localCached.results, at: new Date(localCached.at).toISOString(), cached: true });
  }

  console.log(`[cache] MISS ${cacheKey}`);
  // Load user config from Postgres
  const [profileResult] = await Promise.all([
    db.query('SELECT feed_config, api_keys FROM user_profiles WHERE user_id=$1', [req.user.id]),
  ]);
  const profile = profileResult.rows[0] ?? {};
  const defaults = readDefaults();
  const userCfg  = profile.feed_config ?? {};
  const widgetCfg = userCfg[widgetId] ?? defaults[widgetId] ?? {};
  const sources  = widgetCfg.sources ?? [];
  const custom   = widgetCfg.custom  ?? [];
  const apiKeys  = profile.api_keys  ?? {};

  const results = {};

  // Run enabled built-in sources — coalesce concurrent cache misses for the same source
  // so only one HTTP request is made regardless of how many users miss simultaneously.
  for (const src of sources.filter(s => s.enabled)) {
    const rule = scraper.BUILTIN_SOURCE_RULES[src.id];
    if (!rule) continue;
    const srcKey = `feed:source:${src.id}`;

    // Check source-level cache first
    const cachedSrc = await rGetJson(srcKey) ?? (() => {
      const m = localSourceCache.get(src.id);
      return m && (Date.now() - m.at) < FEED_DATA_CACHE_TTL_MS ? m : null;
    })();
    if (cachedSrc) {
      results[src.id] = { name: src.name, data: cachedSrc.data, error: null };
      continue;
    }

    // Coalesce: if a scrape is already in-flight for this source, await it
    if (!inFlightScrapes.has(src.id)) {
      const scrapePromise = (async () => {
        const data = await scraper.runSource(rule, 'scheduled', { apiKeys });
        const entry = { at: new Date().toISOString(), data };
        await rSet(srcKey, entry, FEED_DATA_CACHE_TTL_S);
        localSourceCache.set(src.id, { at: Date.now(), data });
        console.log(`[cache] SET  source ${srcKey}`);
        return { data, entry };
      })().finally(() => inFlightScrapes.delete(src.id));
      inFlightScrapes.set(src.id, scrapePromise);
    } else {
      console.log(`[cache] COALESCE source ${src.id}`);
    }

    try {
      const { data } = await inFlightScrapes.get(src.id);
      results[src.id] = { name: src.name, category: rule.category ?? null, data, error: null };
    } catch (err) {
      results[src.id] = { name: src.name, category: rule.category ?? null, data: [], error: err.message };
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

  const at = new Date().toISOString();
  // Only cache if at least one source returned items — don't lock in 6 hrs of empty error results
  const anyData = Object.values(results).some(r => r.data && r.data.length > 0);
  if (anyData) {
    await rSet(cacheKey, { at, results }, FEED_DATA_CACHE_TTL_S);
    localFeedCache.set(localKey, { at: Date.now(), results });
    console.log(`[cache] SET  widget ${cacheKey}`);
  } else {
    console.log(`[cache] SKIP widget ${cacheKey} — all sources empty/errored, will retry next request`);
  }
  res.json({ sources: results, at, cached: false });
});

module.exports = router;
