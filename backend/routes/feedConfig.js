// backend/routes/feedConfig.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { verifyToken } = require('../middleware/auth');
const { demoGuard } = require('../middleware/demoGuard');
const scraper = require('../scraper');
const db = require('../db');
const redis = require('../redis');
const { decryptMap } = require('../lib/tokenCrypto');
const { classifyKeyboardItem, inferKeyboardSubkind } = require('../lib/productTaxonomy');

// Max 5 test-rule requests per user per minute (keyed on user ID; route is auth-gated).
const testLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => String(req.user.id),
  message: { error: 'Too many test requests — wait a minute before trying again' },
  standardHeaders: true,
  legacyHeaders: false,
});

const DEFAULTS_FILE = path.join(__dirname, '../userFeedConfig.json');

function readDefaults() {
  try { return JSON.parse(fs.readFileSync(DEFAULTS_FILE, 'utf8')).defaults; } catch { return {}; }
}

function normalizeWidgetConfig(widgetId, widgetCfg, defaults) {
  const fallbackCfg = defaults[widgetId] ?? {};
  const defaultSourcesById = new Map((fallbackCfg.sources ?? []).map(src => [src.id, src]));
  const mergedSources = (widgetCfg.sources ?? fallbackCfg.sources ?? []).map(src => {
    const fallback = src?.id ? defaultSourcesById.get(src.id) : null;
    return fallback ? { ...fallback, ...src } : src;
  });
  return {
    ...fallbackCfg,
    ...widgetCfg,
    sources: mergedSources,
    custom: widgetCfg.custom ?? fallbackCfg.custom ?? [],
  };
}

const KEYBOARD_WIDGET_IDS = new Set([
  'keyboard-releases',
  'keyboard-sales',
  'keyboard-full-release',
  'keyboard-parts-release',
  'keyboard-switches',
  'keyboard-accessories',
  'keycap-releases',
]);

function hasKeyboardPartsSignal(item = {}) {
  const text = [item.name, item.productType, item.tags, item.itemType]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return /\bpcb\b|plate|daughterboard|foam|gasket|weights?\b|mounting|hotswap|solder|socket/.test(text);
}

function hasExplicitKeyboardPartsSignal(item = {}) {
  const text = [item.name, item.productType, item.itemType]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return /\bpcb\b|plate|daughterboard|foam|gasket|weights?\b|mounting|hotswap|solder|socket/.test(text);
}

function looksLikeFullKeyboard(item = {}) {
  const text = [item.name, item.productType, item.itemType]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return /pre.?built|fully built|mechanical keyboard|\bkeyboard\b|alice|\btkl\b|\b65%\b|\b75%\b|\b60%\b/.test(text);
}

function filterItemsForWidget(widgetId, items = [], sourceCategory = '') {
  if (!KEYBOARD_WIDGET_IDS.has(widgetId)) return items;
  const normalizedKeyboardItems = items.map(item => {
    const keyboardSubkind = inferKeyboardSubkind(item);
    if (!keyboardSubkind) return item;
    return { ...item, keyboardSubkind };
  });

  return normalizedKeyboardItems.filter(item => {
    const kind = classifyKeyboardItem(item, sourceCategory);
    if (widgetId === 'keycap-releases') return kind === 'keycaps';
    if (widgetId === 'keyboard-switches') return kind === 'switches';
    if (widgetId === 'keyboard-accessories') return kind === 'accessories';
    if (widgetId === 'keyboard-parts-release') {
      if (kind !== 'parts') return false;
      const hasParts = hasKeyboardPartsSignal(item);
      const hasExplicitParts = hasExplicitKeyboardPartsSignal(item);
      const fullLike = looksLikeFullKeyboard(item);
      if (!(hasParts && !(fullLike && !hasExplicitParts))) return false;

      const title = String(item.name || '').toLowerCase();
      const denylist = [
        /random warehouse keyboards?/,
        /keycult\s+no\.?1\s*\/\s*tkl\s*series/,
        /\bbox\s*75\b(?!.*\bpcb\b)/,
      ];
      if (denylist.some(rx => rx.test(title))) return false;

      return true;
    }
    if (widgetId === 'keyboard-full-release') return kind === 'full';
    if (widgetId === 'keyboard-releases') return kind === 'full';
    if (widgetId === 'keyboard-sales') return kind === 'full';
    return true;
  });
}

// Redis TTL for scrape cache — matches scheduled cooldown in scraper.js
const FEED_DATA_CACHE_TTL_S  = 6 * 60 * 60;  // 6 hours (seconds for Redis EX)
const FEED_DATA_CACHE_TTL_MS = FEED_DATA_CACHE_TTL_S * 1000;

// Bump this when the scraped item shape changes (e.g. new fields added to scraper.js).
// Old versioned keys are never written again and expire naturally via their TTL.
const CACHE_VERSION = 'v7';

// Fallback in-process Maps (used if Redis is unavailable)
const localFeedCache   = new Map();
const localSourceCache = new Map();

// In-flight promise coalescing — prevents multiple concurrent requests from each
// triggering a separate scrape for the same source when the cache is cold.
const inFlightScrapes = new Map(); // sourceId → Promise<{data, entry}>

// Custom source rate limiting — 5 scrapes per user per 60s rolling window.
// Built-in sources are pre-warmed and never count against this.
const customScrapeWindows = new Map(); // userId → [timestamp, ...]
const CUSTOM_SCRAPE_MAX = 5;
const CUSTOM_SCRAPE_WINDOW_MS = 60 * 1000;

function checkCustomRateLimit(userId) {
  const now = Date.now();
  const hits = (customScrapeWindows.get(userId) ?? []).filter(t => now - t < CUSTOM_SCRAPE_WINDOW_MS);
  if (hits.length >= CUSTOM_SCRAPE_MAX) return false;
  hits.push(now);
  customScrapeWindows.set(userId, hits);
  return true;
}

const DEFAULT_AGGREGATED_DEALS_WIDGET_IDS = [
  'active-deals',
  'keyboard-sales',
  'electronics-sales',
  'electronics-microcontrollers',
  'electronics-passives',
  'electronics-sensors',
  'electronics-motors',
  'electronics-ics',
  'electronics-encoders',
  'electronics-power',
  'electronics-connectors',
  'electronics-displays',
  'electronics-wireless',
  'electronics-audio',
];

function parseMoney(value) {
  if (value == null) return 0;
  const parsed = parseFloat(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

// Returns true if the source is a dedicated sale/clearance page rather than a
// general catalog, so items without a comparePrice can still be trusted as on-sale.
function isKnownSaleSource(src) {
  const id = String(src?.id ?? '');
  const rule = scraper.BUILTIN_SOURCE_RULES[id];
  const url = String(rule?.url ?? '');
  return (
    id.endsWith('-sale') ||
    id.endsWith('-sales') ||
    id.includes('garage-sale') ||
    url.includes('/collections/sale/') ||
    url.includes('/collections/garage-sale')
  );
}

function inferCategoryFromItem(item = {}) {
  const text = [item.productType, item.itemType, item.tags, item.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (!text) return null;
  if (/headphone|speaker|audio|mic(?:rophone)?|dac|amp(?:lifier)?|earbuds?|iem\b|headset/.test(text)) return 'Audio';
  if (/switch|pcb|plate|controller|module|sensor|ic\b|resistor|capacitor|inductor|connector|encoder|display|wireless|power|microcontroller|mcu\b|development board|breakout/.test(text)) return 'Components';
  if (/keyboard|keycap|barebones|pre.?built|mechanical/.test(text)) return 'Keyboards';
  if (/electronics|board|kit\b|maker|embedded/.test(text)) return 'Electronics';
  return null;
}

function inferDealCategory(widgetId, item = {}) {
  const inferred = inferCategoryFromItem(item);
  if (widgetId.startsWith('keyboard-') || widgetId === 'active-deals') return inferred ?? 'Keyboards';
  if (widgetId.startsWith('electronics-')) return inferred ?? 'Electronics';
  return inferred;
}

function inferDealSubcategory(widgetId) {
  if (widgetId === 'active-deals') return 'active-deals';
  const [prefix, ...rest] = String(widgetId).split('-');
  if (prefix === 'electronics' || prefix === 'keyboard') {
    return rest.length > 0 ? rest.join('-') : widgetId;
  }
  return widgetId;
}

async function scrapeSourceForWidget({ src, widgetId, apiKeys, userId }) {
  let data = [];
  let error = null;
  let sourceName = src.name ?? src.label ?? src.id ?? 'source';
  let sourceCategory = null;

  try {
    if (src.ruleType === 'user-rss') {
      scraper.validateUserRssUrl(src.url);
      data = await scraper.runSource({ ruleType: 'user-rss', url: src.url, label: src.label }, 'scheduled', { apiKeys });
    } else if (src.ruleType === 'digikey-api') {
      if (!apiKeys.digikey_client_id || !apiKeys.digikey_client_secret) {
        throw new Error('Digikey API keys not configured (digikey_client_id, digikey_client_secret)');
      }
      data = await scraper.runSource(
        { ruleType: 'digikey-api', keywords: src.keywords, limit: src.limit },
        'scheduled',
        { apiKeys }
      );
    } else if (src.ruleType === 'mouser-api') {
      if (!apiKeys.mouser_api_key) {
        throw new Error('Mouser API key not configured (mouser_api_key)');
      }
      data = await scraper.runSource(
        {
          ruleType: 'mouser-api',
          keywords: src.keywords,
          limit: src.limit,
          ...(src.imageSize ? { imageSize: src.imageSize } : {}),
        },
        'scheduled',
        { apiKeys }
      );
    } else if (src.ruleType === 'manual-list') {
      data = await scraper.runSource(
        { ruleType: 'manual-list', listId: src.listId },
        'scheduled',
        { apiKeys, userId }
      );
    } else if (src.ruleType === 'webhook-buffer') {
      data = await scraper.runSource(
        { ruleType: 'webhook-buffer', webhookId: src.webhookId },
        'scheduled',
        { apiKeys }
      );
    } else {
      const rule = scraper.BUILTIN_SOURCE_RULES[src.id];
      if (!rule) return null;
      sourceCategory = rule.category ?? null;
      sourceName = src.name ?? src.label ?? src.id;
      data = await scraper.runSource(rule, 'scheduled', { apiKeys });
    }
  } catch (err) {
    error = err.message;
  }

  const filtered = filterItemsForWidget(widgetId, data, sourceCategory);
  return {
    sourceId: src.id ?? `${src.ruleType}:${src.keywords ?? src.url ?? ''}`,
    sourceName,
    sourceCategory,
    data: filtered,
    error,
  };
}

// Widget data endpoint limiter.
const widgetDataLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  keyGenerator: (req) => String(req.user.id),
  message: { error: 'Too many feed requests — slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Aggregated deals endpoint limiter — separate bucket so widget bursts do not starve deals page.
const aggregatedDealsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: (req) => String(req.user.id),
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
      merged[widgetId] = normalizeWidgetConfig(widgetId, userCfg[widgetId] ?? defaults[widgetId] ?? {}, defaults);
    }
    for (const widgetId of Object.keys(userCfg)) {
      if (!merged[widgetId]) merged[widgetId] = normalizeWidgetConfig(widgetId, userCfg[widgetId] ?? {}, defaults);
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

// GET /api/feed-config/data-aggregated/deals  — merge sales-like feeds across categories/subcategories
router.get('/data-aggregated/deals', verifyToken, aggregatedDealsLimiter, async (req, res) => {
  try {
    const widgetsFromQuery = String(req.query.widgets ?? '')
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);
    const targetWidgetIds = widgetsFromQuery.length > 0
      ? widgetsFromQuery
      : DEFAULT_AGGREGATED_DEALS_WIDGET_IDS;

    const profileResult = await db.query('SELECT feed_config, api_keys FROM user_profiles WHERE user_id=$1', [req.user.id]);
    const profile = profileResult.rows[0] ?? {};
    const defaults = readDefaults();
    const userCfg = profile.feed_config ?? {};
    const decryptedApiKeys = decryptMap(profile.api_keys ?? {});
    const apiKeys = {
      ...decryptedApiKeys,
      mouser_api_key: decryptedApiKeys.mouser_api_key ?? process.env.MOUSER_API_KEY ?? undefined,
      digikey_client_id: decryptedApiKeys.digikey_client_id ?? process.env.DIGIKEY_CLIENT_ID ?? undefined,
      digikey_client_secret: decryptedApiKeys.digikey_client_secret ?? process.env.DIGIKEY_CLIENT_SECRET ?? undefined,
    };

    const sourceSummaries = [];
    const deals = [];
    const seen = new Set();

    for (const widgetId of targetWidgetIds) {
      const widgetCfg = normalizeWidgetConfig(widgetId, userCfg[widgetId] ?? defaults[widgetId] ?? {}, defaults);
      const enabledSources = (widgetCfg.sources ?? []).filter(src => src.enabled);

      for (const src of enabledSources) {
        const scraped = await scrapeSourceForWidget({ src, widgetId, apiKeys, userId: req.user.id });
        if (!scraped) continue;

        const skipCounts = { outOfStock: 0, noPrice: 0, belowThreshold: 0, noDiscount: 0 };
        let accepted = 0;

        for (const item of scraped.data) {
          // 1. Stock gate — hide out-of-stock items
          if (item.anyAvailable === 'false') { skipCounts.outOfStock++; continue; }

          const price = parseMoney(item.price);
          const comparePrice = parseMoney(item.comparePrice);

          // 2. Price gate — must have a real sale price
          if (price <= 0) { skipCounts.noPrice++; continue; }

          // 3. Sale gate
          if (comparePrice > 0) {
            // Explicit compare price present — require at least 2% discount
            const discount = (comparePrice - price) / comparePrice;
            if (discount < 0.02) { skipCounts.belowThreshold++; continue; }
          } else if (!isKnownSaleSource(src)) {
            // No compare price and not a trusted sale page — skip
            skipCounts.noDiscount++; continue;
          }

          const dedupeKey = String(item.url || `${item._vendor || scraped.sourceName}:${item.name}:${price}`).toLowerCase();
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);
          accepted++;

          const dealCategory = inferDealCategory(widgetId, item);
          deals.push({
            id: crypto.createHash('sha1').update(dedupeKey).digest('hex').slice(0, 16),
            name: item.name,
            url: item.url ?? undefined,
            image: item.image ?? undefined,
            vendor: item._vendor ?? scraped.sourceName,
            productType: item.productType ?? null,
            price,
            comparePrice: comparePrice > 0 ? comparePrice : null,
            category: dealCategory,
            subcategory: inferDealSubcategory(widgetId),
            keyboardSubkind: dealCategory === 'Keyboards' ? inferKeyboardSubkind(item) : undefined,
            sourceWidgetId: widgetId,
            sourceId: scraped.sourceId,
            sourceName: scraped.sourceName,
          });
        }

        sourceSummaries.push({
          widgetId,
          sourceId: scraped.sourceId,
          name: scraped.sourceName,
          count: scraped.data.length,
          accepted,
          skipped: skipCounts,
          error: scraped.error,
        });
      }
    }

    res.json({
      at: new Date().toISOString(),
      widgetIds: targetWidgetIds,
      items: deals,
      sources: sourceSummaries,
    });
  } catch (err) {
    console.error('GET /feed-config/data-aggregated/deals error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/feed-config/data/:widgetId  — scrape enabled built-in + custom sources for a widget
router.get('/data/:widgetId', verifyToken, widgetDataLimiter, async (req, res) => {
  const { widgetId } = req.params;
  const cacheKey = `feed:${CACHE_VERSION}:widget:${req.user.id}:${widgetId}`;
  const localKey  = `${req.user.id}:${widgetId}`;

  // Load user config first so we can honor live-fetch rules (e.g. Mouser no-cache)
  const [profileResult] = await Promise.all([
    db.query('SELECT feed_config, api_keys FROM user_profiles WHERE user_id=$1', [req.user.id]),
  ]);
  const profile = profileResult.rows[0] ?? {};
  const defaults = readDefaults();
  const userCfg  = profile.feed_config ?? {};
  const widgetCfg = normalizeWidgetConfig(widgetId, userCfg[widgetId] ?? defaults[widgetId] ?? {}, defaults);
  const sources  = widgetCfg.sources ?? [];
  const custom   = widgetCfg.custom  ?? [];
  const hasLiveMouserSource = sources.some(src => src.enabled && src.ruleType === 'mouser-api');

  if (!hasLiveMouserSource) {
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
  } else {
    console.log(`[cache] BYPASS widget ${cacheKey} — mouser-api source enabled`);
  }

  console.log(`[cache] MISS ${cacheKey}`);
  const decryptedApiKeys = decryptMap(profile.api_keys ?? {});
  const apiKeys  = {
    ...decryptedApiKeys,
    mouser_api_key: decryptedApiKeys.mouser_api_key ?? process.env.MOUSER_API_KEY ?? undefined,
    digikey_client_id: decryptedApiKeys.digikey_client_id ?? process.env.DIGIKEY_CLIENT_ID ?? undefined,
    digikey_client_secret: decryptedApiKeys.digikey_client_secret ?? process.env.DIGIKEY_CLIENT_SECRET ?? undefined,
  };

  const results = {};

  // Run enabled built-in + user-rss sources — coalesce concurrent cache misses for the same
  // source so only one HTTP request is made regardless of how many users miss simultaneously.
  for (const src of sources.filter(s => s.enabled)) {
    let rule, srcKey, resultKey, localKey;

    if (src.ruleType === 'user-rss') {
      // Validate SSRF early — surface error immediately so the widget can show it
      try { scraper.validateUserRssUrl(src.url); } catch (e) {
        const k = `user-rss:${src.url}`;
        results[k] = { name: src.label ?? src.url, data: [], error: e.message };
        continue;
      }
      rule      = { ruleType: 'user-rss', url: src.url, label: src.label };
      const urlHash = crypto.createHash('sha256').update(src.url).digest('hex').slice(0, 16);
      srcKey    = `feed:${CACHE_VERSION}:source:user-rss:${urlHash}`;
      resultKey = `user-rss:${src.url}`;
      localKey  = srcKey;  // use the hash-based key for the in-process map too

    } else if (src.ruleType === 'digikey-api') {
      // No caching — always live request
      const dkName = src.name ?? src.label ?? `Digikey: ${src.keywords}`;
      const dkKey  = `digikey-api:${src.keywords ?? src.id}`;
      if (!apiKeys.digikey_client_id || !apiKeys.digikey_client_secret) {
        results[dkKey] = { name: dkName, data: [], error: 'Digikey API keys not configured (digikey_client_id, digikey_client_secret)' };
        continue;
      }
      const dkRule = { ruleType: 'digikey-api', keywords: src.keywords, limit: src.limit };
      try {
        const data = await scraper.runSource(dkRule, 'scheduled', { apiKeys });
        results[dkKey] = { name: dkName, category: null, data: filterItemsForWidget(widgetId, data, null), error: null };
      } catch (err) {
        results[dkKey] = { name: dkName, category: null, data: [], error: err.message };
      }
      continue; // skip all caching logic below

    } else if (src.ruleType === 'manual-list') {
      // Items live in Postgres — read live, skip source cache entirely
      const mlName = src.name ?? src.label ?? `List: ${src.listId}`;
      const mlKey  = `manual-list:${src.listId}`;
      const mlRule = { ruleType: 'manual-list', listId: src.listId };
      try {
        const data = await scraper.runSource(mlRule, 'scheduled', { apiKeys, userId: req.user.id });
        results[mlKey] = { name: mlName, category: null, data: filterItemsForWidget(widgetId, data, null), error: null };
      } catch (err) {
        results[mlKey] = { name: mlName, category: null, data: [], error: err.message };
      }
      continue; // skip source-level cache logic

    } else if (src.ruleType === 'webhook-buffer') {
      // Ring buffer already lives in Redis — read live, skip source cache entirely
      const wbName = src.name ?? src.label ?? `Webhook: ${src.webhookId}`;
      const wbKey  = `webhook-buffer:${src.webhookId}`;
      const wbRule = { ruleType: 'webhook-buffer', webhookId: src.webhookId };
      try {
        const data = await scraper.runSource(wbRule, 'scheduled', { apiKeys });
        results[wbKey] = { name: wbName, category: null, data: filterItemsForWidget(widgetId, data, null), error: null };
      } catch (err) {
        results[wbKey] = { name: wbName, category: null, data: [], error: err.message };
      }
      continue; // skip source-level cache logic

    } else if (src.ruleType === 'mouser-api') {
      // Mouser ToS §4: no caching — always make a live request, never read or write cache
      const mouserName = src.name ?? src.label ?? `Mouser: ${src.keywords}`;
      const mouserKey  = `mouser-api:${src.keywords ?? src.id}`;
      if (!apiKeys.mouser_api_key) {
        results[mouserKey] = { name: mouserName, data: [], error: 'Mouser API key not configured (mouser_api_key)' };
        continue;
      }
      const mouserRule = {
        ruleType: 'mouser-api',
        keywords: src.keywords,
        limit: src.limit,
        ...(src.imageSize ? { imageSize: src.imageSize } : {}),
      };
      try {
        const data = await scraper.runSource(mouserRule, 'scheduled', { apiKeys });
        results[mouserKey] = { name: mouserName, category: null, data: filterItemsForWidget(widgetId, data, null), error: null };
      } catch (err) {
        results[mouserKey] = { name: mouserName, category: null, data: [], error: err.message };
      }
      continue; // skip all caching logic below

    } else {
      rule = scraper.BUILTIN_SOURCE_RULES[src.id];
      if (!rule) continue;
      srcKey    = `feed:${CACHE_VERSION}:source:${src.id}`;
      resultKey = src.id;
      localKey  = src.id;
    }

    const srcName = src.name ?? src.label ?? resultKey;

    // Check source-level cache first
    const cachedSrc = await rGetJson(srcKey) ?? (() => {
      const m = localSourceCache.get(localKey);
      return m && (Date.now() - m.at) < FEED_DATA_CACHE_TTL_MS ? m : null;
    })();
    if (cachedSrc) {
      const filteredCachedData = filterItemsForWidget(widgetId, cachedSrc.data, rule.category ?? null);
      results[resultKey] = { name: srcName, category: rule.category ?? null, data: filteredCachedData, error: null };
      continue;
    }

    // Coalesce: if a scrape is already in-flight for this source, await it
    if (!inFlightScrapes.has(srcKey)) {
      const scrapePromise = (async () => {
        const data = await scraper.runSource(rule, 'scheduled', { apiKeys });
        const entry = { at: new Date().toISOString(), data };
        await rSet(srcKey, entry, FEED_DATA_CACHE_TTL_S);
        localSourceCache.set(localKey, { at: Date.now(), data });
        console.log(`[cache] SET  source ${srcKey}`);
        return { data, entry };
      })().finally(() => inFlightScrapes.delete(srcKey));
      inFlightScrapes.set(srcKey, scrapePromise);
    } else {
      console.log(`[cache] COALESCE source ${srcKey}`);
    }

    try {
      const { data } = await inFlightScrapes.get(srcKey);
      const filteredData = filterItemsForWidget(widgetId, data, rule.category ?? null);
      results[resultKey] = { name: srcName, category: rule.category ?? null, data: filteredData, error: null };
    } catch (err) {
      results[resultKey] = { name: srcName, category: rule.category ?? null, data: [], error: err.message };
    }
  }

  // Run enabled custom rules — rate-limited to 5 scrapes per user per minute
  for (const rule of custom) {
    if (!checkCustomRateLimit(req.user.id)) {
      results[`custom:${rule.name}`] = { name: rule.name, data: [], error: 'Custom source rate limit exceeded — wait a moment before refreshing again' };
      continue;
    }
    try {
      const data = await scraper.runSource(rule, 'scheduled');
      results[`custom:${rule.name}`] = { name: rule.name, data: filterItemsForWidget(widgetId, data, null), error: null };
    } catch (err) {
      results[`custom:${rule.name}`] = { name: rule.name, data: [], error: err.message };
    }
  }

  const at = new Date().toISOString();
  // Only cache if at least one source returned items — don't lock in 6 hrs of empty error results
  const anyData = Object.values(results).some(r => r.data && r.data.length > 0);
  if (anyData && !hasLiveMouserSource) {
    await rSet(cacheKey, { at, results }, FEED_DATA_CACHE_TTL_S);
    localFeedCache.set(localKey, { at: Date.now(), results });
    console.log(`[cache] SET  widget ${cacheKey}`);
  } else if (anyData && hasLiveMouserSource) {
    console.log(`[cache] SKIP widget ${cacheKey} — mouser-api source enabled`);
  } else {
    console.log(`[cache] SKIP widget ${cacheKey} — all sources empty/errored, will retry next request`);
  }
  res.json({ sources: results, at, cached: false });
});

// Pre-warm all default built-in source caches so no user ever triggers a cold scrape.
// Called on startup (after health checks) and on the 6-hour cron.
async function warmAllSources() {
  const defaults = readDefaults();
  // Collect unique enabled built-in source IDs across all widgets
  const sourceIds = [...new Set(
    Object.values(defaults).flatMap(w =>
      (w.sources ?? []).filter(s => s.enabled && scraper.BUILTIN_SOURCE_RULES[s.id]).map(s => s.id)
    )
  )];
  console.log(`[cache] warm starting — ${sourceIds.length} built-in sources to check`);
  let warmed = 0;
  const hostsScrapedThisRun = new Set();
  for (const sourceId of sourceIds) {
    const srcKey = `feed:${CACHE_VERSION}:source:${sourceId}`;
    const cached = await rGetJson(srcKey) ?? (() => {
      const m = localSourceCache.get(sourceId);
      return m && (Date.now() - m.at) < FEED_DATA_CACHE_TTL_MS ? m : null;
    })();
    if (cached) continue; // already warm

    // Skip sources sharing a hostname already hit this run — scraper enforces per-host cooldown
    const rule = scraper.BUILTIN_SOURCE_RULES[sourceId];
    let hostname;
    try { hostname = new URL(rule.url).hostname; } catch { hostname = null; }
    if (hostname && hostsScrapedThisRun.has(hostname)) {
      console.log(`[cache] warm SKIP source ${sourceId} — ${hostname} already scraped this run`);
      continue;
    }

    if (!inFlightScrapes.has(sourceId)) {
      const scrapePromise = (async () => {
        const data = await scraper.runSource(rule, 'scheduled', {});
        const entry = { at: new Date().toISOString(), data };
        await rSet(srcKey, entry, FEED_DATA_CACHE_TTL_S);
        localSourceCache.set(sourceId, { at: Date.now(), data });
        console.log(`[cache] warm SET  source ${srcKey}`);
        return { data, entry };
      })().finally(() => inFlightScrapes.delete(sourceId));
      inFlightScrapes.set(sourceId, scrapePromise);
    }
    try {
      await inFlightScrapes.get(sourceId);
      if (hostname) hostsScrapedThisRun.add(hostname);
      warmed++;
    } catch (err) {
      console.warn(`[cache] warm FAIL source ${sourceId}: ${err.message}`);
    }
    // Stagger requests to avoid hammering hosts on cold start
    await new Promise(r => setTimeout(r, 250));
  }
  console.log(`[cache] warm complete — ${warmed} sources refreshed`);
}

module.exports = { router, warmAllSources, filterItemsForWidget };
