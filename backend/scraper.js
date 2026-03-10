// backend/scraper.js
// Node.js backend for periodic scraping and caching — with anti-abuse guards

'use strict';

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const { JSONPath } = require('jsonpath-plus');

// ─── Guard configuration ───────────────────────────────────────────────────────
// These constants define the defensive limits. Adjust conservatively.

/** Minimum ms between scheduled (cron) requests to the same hostname. Default: 6 hours. */
const SCHEDULED_COOLDOWN_MS = 6 * 60 * 60 * 1000;

/** Minimum ms between user-triggered /test requests to the same hostname. Default: 1 min. */
const TEST_COOLDOWN_MS = 60 * 1000;

/** Polite delay injected between sequential requests in a batch. Default: 2.5 s. */
const INTER_REQUEST_DELAY_MS = 2500;

/** Hard HTTP timeout per request. Default: 10 s. */
const REQUEST_TIMEOUT_MS = 10_000;

/** Max concurrent in-flight requests to the same hostname at once. Default: 1. */
const MAX_CONCURRENT_PER_HOST = 1;

/** Rotate realistic browser UA strings to avoid trivial bot detection. */
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ─── In-memory rate tracking ───────────────────────────────────────────────────
// These Maps reset on server restart, which is sufficient for a single-process
// dev server. For multi-process production, move to Redis or a shared DB.

/** hostname → last-request timestamp (ms) */
const lastScrapeTime = new Map();

/** hostname → current in-flight request count */
const inFlight = new Map();

function getHostname(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

function isOnCooldown(hostname, mode = 'scheduled') {
  const last = lastScrapeTime.get(hostname);
  if (!last) return false;
  const limit = mode === 'test' ? TEST_COOLDOWN_MS : SCHEDULED_COOLDOWN_MS;
  return (Date.now() - last) < limit;
}

function cooldownRemaining(hostname, mode = 'scheduled') {
  const last = lastScrapeTime.get(hostname) ?? 0;
  const limit = mode === 'test' ? TEST_COOLDOWN_MS : SCHEDULED_COOLDOWN_MS;
  return Math.max(0, Math.ceil((limit - (Date.now() - last)) / 1000));
}

/** Spin-wait until concurrency slot is free, then claim it. Times out after 30 s. */
async function acquireSlot(hostname) {
  let waited = 0;
  while ((inFlight.get(hostname) ?? 0) >= MAX_CONCURRENT_PER_HOST) {
    const delay = Math.min(500 + waited * 100, 2000);
    await sleep(delay);
    waited += delay;
    if (waited > 30_000) {
      throw new Error(`Concurrency limit for ${hostname} — gave up after 30 s`);
    }
  }
  inFlight.set(hostname, (inFlight.get(hostname) ?? 0) + 1);
}

function releaseSlot(hostname) {
  inFlight.set(hostname, Math.max(0, (inFlight.get(hostname) ?? 1) - 1));
}

function recordScrape(hostname) {
  lastScrapeTime.set(hostname, Date.now());
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Core fetch with all guards applied ───────────────────────────────────────

/**
 * Fetch a URL with: per-host cooldown, concurrency cap, timeout, rotating UA.
 * @param {string} url
 * @param {'scheduled'|'test'} mode
 * @param {'text'|'json'} responseType
 */
async function guardedFetch(url, mode = 'scheduled', responseType = 'text') {
  const hostname = getHostname(url);

  if (isOnCooldown(hostname, mode)) {
    throw new Error(
      `Rate limit: ${hostname} is on cooldown — ${cooldownRemaining(hostname, mode)}s remaining`
    );
  }

  await acquireSlot(hostname);
  try {
    recordScrape(hostname);
    const response = await axios.get(url, {
      timeout: REQUEST_TIMEOUT_MS,
      responseType,
      headers: {
        'User-Agent': randomUA(),
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': responseType === 'json'
          ? 'application/json'
          : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Cache-Control': 'no-cache',
      },
      // Don't auto-throw on 4xx so we can return readable errors
      validateStatus: s => s < 500,
    });

    if (response.status === 429) throw new Error(`Target ${hostname} is rate-limiting us (HTTP 429) — back off`);
    if (response.status === 403) throw new Error(`Access denied by ${hostname} (HTTP 403) — the site may block scrapers`);
    if (response.status >= 400) throw new Error(`HTTP ${response.status} from ${hostname}`);

    return response.data;
  } finally {
    releaseSlot(hostname);
  }
}

// ─── Rule runners ─────────────────────────────────────────────────────────────

/**
 * Scrape an HTML page with a CSS selector (cheerio).
 * Supports two modes:
 *  - Legacy single-field: { url, selector, fieldName, attribute }
 *  - Multi-field container: { url, containerSelector, fields: [{selector, fieldName, attribute}] }
 * In multi-field mode relative image/href values are resolved to absolute URLs.
 */
async function scrapeHtml(rule, mode = 'scheduled') {
  const { url, containerSelector, fields, selector, fieldName, attribute } = rule;
  const html = await guardedFetch(url, mode, 'text');
  const $ = cheerio.load(html);
  const results = [];

  if (containerSelector && Array.isArray(fields) && fields.length) {
    const origin = (() => { try { return new URL(url).origin; } catch { return ''; } })();
    $(containerSelector).each((_, container) => {
      const obj = {};
      for (const f of fields) {
        const el = f.selector ? $(container).find(f.selector).first() : $(container);
        let value;
        if (f.attribute) {
          if (f.attribute === 'src') {
            // Try src then common lazy-load data attributes
            value = el.attr('src') || el.attr('data-src') || el.attr('data-lazy-src') || el.attr('data-original') || '';
          } else {
            value = el.attr(f.attribute) || '';
          }
          // Resolve relative URLs
          if (value && value.startsWith('/') && origin) value = origin + value;
        } else {
          value = el.text().trim();
        }
        if (value) obj[f.fieldName] = value;
      }
      if (fields[0] && obj[fields[0].fieldName]) results.push(obj);
    });
  } else {
    $(selector).each((_, el) => {
      const value = attribute ? $(el).attr(attribute) : $(el).text().trim();
      if (value) results.push({ [fieldName]: value });
    });
  }
  return results;
}

/** Scrape a JSON endpoint with a JSONPath expression (jsonpath-plus). */
async function scrapeJson({ url, selector, fieldName }, mode = 'scheduled') {
  const data = await guardedFetch(url, mode, 'json');
  const values = JSONPath({ path: selector, json: data });
  return values.map(v => ({ [fieldName]: v }));
}

/**
 * Scrape a JSON endpoint where each item in an array has multiple fields.
 * Designed for Shopify /products.json and similar structured APIs.
 * Rule shape: { url, containerPath, fields: [{path, fieldName}], baseUrl? }
 *   containerPath — JSONPath to the array of items, e.g. '$.products[*]'
 *   fields        — per-item JSONPath expressions mapped to output field names
 *   baseUrl       — optional prefix to build a product URL from a handle/slug
 */
async function scrapeJsonMulti({ url, containerPath, fields, baseUrl }, mode = 'scheduled') {
  const data = await guardedFetch(url, mode, 'json');
  const containers = JSONPath({ path: containerPath, json: data });
  const results = [];
  for (const container of containers) {
    const obj = {};
    for (const f of fields) {
      const values = JSONPath({ path: f.path, json: container });
      const raw = values.length > 0 && values[0] != null ? String(values[0]) : '';
      if (raw) obj[f.fieldName] = raw;
    }
    // Build absolute product URL from handle if baseUrl provided
    if (baseUrl && obj.handle) obj.url = baseUrl + obj.handle;
    // Only include items that have at least a name
    if (obj.name) results.push(obj);
  }
  return results;
}

/** Route a rule to the correct scraper by ruleType. */
async function runSource(opts, mode = 'scheduled') {
  if (opts.ruleType === 'css')            return scrapeHtml(opts, mode);
  if (opts.ruleType === 'jsonpath')       return scrapeJson(opts, mode);
  if (opts.ruleType === 'jsonpath-multi') return scrapeJsonMulti(opts, mode);
  throw new Error(`Unknown ruleType: "${opts.ruleType}". Must be "css", "jsonpath", or "jsonpath-multi".`);
}

/**
 * User-triggered rule test. Enforces TEST_COOLDOWN_MS (1 min) per hostname.
 * Returns first 10 matches only.
 */
async function testRule(rule) {
  const results = await runSource(rule, 'test');
  return results.slice(0, 10);
}

/**
 * Scrape a batch of sources with INTER_REQUEST_DELAY_MS between each hit.
 * Errors per-source are caught and surfaced without aborting the whole batch.
 */
async function scratchBatch(sources) {
  const results = [];
  for (const source of sources) {
    try {
      const data = await runSource(source, 'scheduled');
      results.push({ source, data, error: null });
    } catch (err) {
      results.push({ source, data: [], error: err.message });
    }
    await sleep(INTER_REQUEST_DELAY_MS);
  }
  return results;
}

// ─── Built-in source rules ────────────────────────────────────────────────────
// Maps a feed-config source ID to its ready-to-run scraping definition.
// These selectors target Microcenter category listing pages (h2.h_name a is the
// product-name anchor inside each result card). Adjust if Microcenter ever
// redesigns their listing markup.
// Each built-in rule uses containerSelector + fields to extract name, image, price and URL
// per product card in a single page pass. The image field uses src with data-src fallback
// (handled in scrapeHtml) to support Microcenter's lazy-loaded thumbnails.
const BUILTIN_SOURCE_RULES = {
  'microcenter-ram': {
    url: 'https://www.microcenter.com/category/4294967029/memory',
    ruleType: 'css',
    containerSelector: 'li.product_wrapper',
    fields: [
      { selector: 'h2.h_name a',       fieldName: 'name' },
      { selector: 'div.image-box img',  fieldName: 'image', attribute: 'src' },
      { selector: 'span.price',         fieldName: 'price' },
      { selector: 'h2.h_name a',        fieldName: 'url',   attribute: 'href' },
    ],
    label: 'Microcenter — Memory',
  },
  'microcenter-gpu': {
    url: 'https://www.microcenter.com/category/4294966937/video-cards',
    ruleType: 'css',
    containerSelector: 'li.product_wrapper',
    fields: [
      { selector: 'h2.h_name a',       fieldName: 'name' },
      { selector: 'div.image-box img',  fieldName: 'image', attribute: 'src' },
      { selector: 'span.price',         fieldName: 'price' },
      { selector: 'h2.h_name a',        fieldName: 'url',   attribute: 'href' },
    ],
    label: 'Microcenter — Video Cards',
  },
  'microcenter-keyboards': {
    url: 'https://www.microcenter.com/category/4294966635/keyboards',
    ruleType: 'css',
    containerSelector: 'li.product_wrapper',
    fields: [
      { selector: 'h2.h_name a',       fieldName: 'name' },
      { selector: 'div.image-box img',  fieldName: 'image', attribute: 'src' },
      { selector: 'span.price',         fieldName: 'price' },
      { selector: 'h2.h_name a',        fieldName: 'url',   attribute: 'href' },
    ],
    label: 'Microcenter — Keyboards',
  },
  'microcenter-electronics': {
    url: 'https://www.microcenter.com/category/4294966773/development-boards-kits',
    ruleType: 'css',
    containerSelector: 'li.product_wrapper',
    fields: [
      { selector: 'h2.h_name a',       fieldName: 'name' },
      { selector: 'div.image-box img',  fieldName: 'image', attribute: 'src' },
      { selector: 'span.price',         fieldName: 'price' },
      { selector: 'h2.h_name a',        fieldName: 'url',   attribute: 'href' },
    ],
    label: 'Microcenter — Dev Boards & Kits',
  },

  // ─── Keyboard vendors (Shopify products.json API) ──────────────────────────
  // Shopify's /products.json endpoint is a public, stable JSON API that returns
  // structured product data including CDN-hosted images — no HTML parsing needed.

  'cannonkeys-keyboards': {
    url: 'https://cannonkeys.com/collections/in-stock-keyboards/products.json?limit=50',
    ruleType: 'jsonpath-multi',
    containerPath: '$.products[*]',
    fields: [
      { path: '$.title',               fieldName: 'name' },
      { path: '$.images[0].src',       fieldName: 'image' },
      { path: '$.variants[0].price',   fieldName: 'price' },
      { path: '$.handle',              fieldName: 'handle' },
    ],
    baseUrl: 'https://cannonkeys.com/products/',
    label: 'CannonKeys — In-Stock Keyboards',
    category: 'Keyboards',
    vendor: 'CannonKeys',
  },
  'novelkeys-keyboards': {
    url: 'https://novelkeys.com/collections/keyboards/products.json?limit=50',
    ruleType: 'jsonpath-multi',
    containerPath: '$.products[*]',
    fields: [
      { path: '$.title',               fieldName: 'name' },
      { path: '$.images[0].src',       fieldName: 'image' },
      { path: '$.variants[0].price',   fieldName: 'price' },
      { path: '$.handle',              fieldName: 'handle' },
    ],
    baseUrl: 'https://novelkeys.com/products/',
    label: 'NovelKeys — Keyboards',
    category: 'Keyboards',
    vendor: 'NovelKeys',
  },
  'kbdfans-keyboards': {
    url: 'https://kbdfans.com/collections/keyboard/products.json?limit=50',
    ruleType: 'jsonpath-multi',
    containerPath: '$.products[*]',
    fields: [
      { path: '$.title',               fieldName: 'name' },
      { path: '$.images[0].src',       fieldName: 'image' },
      { path: '$.variants[0].price',   fieldName: 'price' },
      { path: '$.handle',              fieldName: 'handle' },
    ],
    baseUrl: 'https://kbdfans.com/products/',
    label: 'KBDfans — Keyboards',
    category: 'Keyboards',
    vendor: 'KBDfans',
  },
  '1upkeyboards-keyboards': {
    url: 'https://www.1upkeyboards.com/collections/keyboard-kits/products.json?limit=50',
    ruleType: 'jsonpath-multi',
    containerPath: '$.products[*]',
    fields: [
      { path: '$.title',               fieldName: 'name' },
      { path: '$.images[0].src',       fieldName: 'image' },
      { path: '$.variants[0].price',   fieldName: 'price' },
      { path: '$.handle',              fieldName: 'handle' },
    ],
    baseUrl: 'https://www.1upkeyboards.com/products/',
    label: '1upKeyboards — Keyboard Kits',
    category: 'Keyboards',
    vendor: '1upKeyboards',
  },

  // ─── Keycap vendors (Shopify products.json API) ────────────────────────────

  'novelkeys-keycaps': {
    url: 'https://novelkeys.com/collections/keycaps/products.json?limit=50',
    ruleType: 'jsonpath-multi',
    containerPath: '$.products[*]',
    fields: [
      { path: '$.title',               fieldName: 'name' },
      { path: '$.images[0].src',       fieldName: 'image' },
      { path: '$.variants[0].price',   fieldName: 'price' },
      { path: '$.handle',              fieldName: 'handle' },
    ],
    baseUrl: 'https://novelkeys.com/products/',
    label: 'NovelKeys — Keycaps',
    category: 'Keycaps',
    vendor: 'NovelKeys',
  },
  'kbdfans-keycaps': {
    url: 'https://kbdfans.com/collections/keycaps/products.json?limit=50',
    ruleType: 'jsonpath-multi',
    containerPath: '$.products[*]',
    fields: [
      { path: '$.title',               fieldName: 'name' },
      { path: '$.images[0].src',       fieldName: 'image' },
      { path: '$.variants[0].price',   fieldName: 'price' },
      { path: '$.handle',              fieldName: 'handle' },
    ],
    baseUrl: 'https://kbdfans.com/products/',
    label: 'KBDfans — Keycaps',
    category: 'Keycaps',
    vendor: 'KBDfans',
  },
  'cannonkeys-keycaps': {
    url: 'https://cannonkeys.com/collections/keycaps/products.json?limit=50',
    ruleType: 'jsonpath-multi',
    containerPath: '$.products[*]',
    fields: [
      { path: '$.title',               fieldName: 'name' },
      { path: '$.images[0].src',       fieldName: 'image' },
      { path: '$.variants[0].price',   fieldName: 'price' },
      { path: '$.handle',              fieldName: 'handle' },
    ],
    baseUrl: 'https://cannonkeys.com/products/',
    label: 'CannonKeys — Keycaps',
    category: 'Keycaps',
    vendor: 'CannonKeys',
  },
  'omnitype-keycaps': {
    url: 'https://omnitype.com/collections/keycaps/products.json?limit=50',
    ruleType: 'jsonpath-multi',
    containerPath: '$.products[*]',
    fields: [
      { path: '$.title',               fieldName: 'name' },
      { path: '$.images[0].src',       fieldName: 'image' },
      { path: '$.variants[0].price',   fieldName: 'price' },
      { path: '$.handle',              fieldName: 'handle' },
    ],
    baseUrl: 'https://omnitype.com/products/',
    label: 'Omnitype — Keycaps',
    category: 'Keycaps',
    vendor: 'Omnitype',
  },

  // ─── Switch vendors ────────────────────────────────────────────────────────

  'novelkeys-switches': {
    url: 'https://novelkeys.com/collections/switches/products.json?limit=50',
    ruleType: 'jsonpath-multi',
    containerPath: '$.products[*]',
    fields: [
      { path: '$.title',               fieldName: 'name' },
      { path: '$.images[0].src',       fieldName: 'image' },
      { path: '$.variants[0].price',   fieldName: 'price' },
      { path: '$.handle',              fieldName: 'handle' },
    ],
    baseUrl: 'https://novelkeys.com/products/',
    label: 'NovelKeys — Switches',
    category: 'Switches',
    vendor: 'NovelKeys',
  },
  'cannonkeys-switches': {
    url: 'https://cannonkeys.com/collections/switches/products.json?limit=50',
    ruleType: 'jsonpath-multi',
    containerPath: '$.products[*]',
    fields: [
      { path: '$.title',               fieldName: 'name' },
      { path: '$.images[0].src',       fieldName: 'image' },
      { path: '$.variants[0].price',   fieldName: 'price' },
      { path: '$.handle',              fieldName: 'handle' },
    ],
    baseUrl: 'https://cannonkeys.com/products/',
    label: 'CannonKeys — Switches',
    category: 'Switches',
    vendor: 'CannonKeys',
  },

  // ─── Sale collections (active-deals widget) ────────────────────────────────
  // Shopify sale collections — same stable products.json API, discounted items only

  'cannonkeys-sale': {
    url: 'https://cannonkeys.com/collections/sale/products.json?limit=50',
    ruleType: 'jsonpath-multi',
    containerPath: '$.products[*]',
    fields: [
      { path: '$.title',               fieldName: 'name' },
      { path: '$.images[0].src',       fieldName: 'image' },
      { path: '$.variants[0].price',   fieldName: 'price' },
      { path: '$.variants[0].compare_at_price', fieldName: 'comparePrice' },
      { path: '$.handle',              fieldName: 'handle' },
      { path: '$.product_type',        fieldName: 'productType' },
    ],
    baseUrl: 'https://cannonkeys.com/products/',
    label: 'CannonKeys — Sale',
    category: 'Keyboards',
    vendor: 'CannonKeys',
  },
  'novelkeys-sale': {
    url: 'https://novelkeys.com/collections/sale/products.json?limit=50',
    ruleType: 'jsonpath-multi',
    containerPath: '$.products[*]',
    fields: [
      { path: '$.title',               fieldName: 'name' },
      { path: '$.images[0].src',       fieldName: 'image' },
      { path: '$.variants[0].price',   fieldName: 'price' },
      { path: '$.variants[0].compare_at_price', fieldName: 'comparePrice' },
      { path: '$.handle',              fieldName: 'handle' },
      { path: '$.product_type',        fieldName: 'productType' },
    ],
    baseUrl: 'https://novelkeys.com/products/',
    label: 'NovelKeys — Sale',
    category: 'Keyboards',
    vendor: 'NovelKeys',
  },
  'kbdfans-sale': {
    url: 'https://kbdfans.com/collections/sale/products.json?limit=50',
    ruleType: 'jsonpath-multi',
    containerPath: '$.products[*]',
    fields: [
      { path: '$.title',               fieldName: 'name' },
      { path: '$.images[0].src',       fieldName: 'image' },
      { path: '$.variants[0].price',   fieldName: 'price' },
      { path: '$.variants[0].compare_at_price', fieldName: 'comparePrice' },
      { path: '$.handle',              fieldName: 'handle' },
      { path: '$.product_type',        fieldName: 'productType' },
    ],
    baseUrl: 'https://kbdfans.com/products/',
    label: 'KBDfans — Sale',
    category: 'Keyboards',
    vendor: 'KBDfans',
  },
  '1upkeyboards-sale': {
    url: 'https://www.1upkeyboards.com/collections/sale/products.json?limit=50',
    ruleType: 'jsonpath-multi',
    containerPath: '$.products[*]',
    fields: [
      { path: '$.title',               fieldName: 'name' },
      { path: '$.images[0].src',       fieldName: 'image' },
      { path: '$.variants[0].price',   fieldName: 'price' },
      { path: '$.variants[0].compare_at_price', fieldName: 'comparePrice' },
      { path: '$.handle',              fieldName: 'handle' },
      { path: '$.product_type',        fieldName: 'productType' },
    ],
    baseUrl: 'https://www.1upkeyboards.com/products/',
    label: '1upKeyboards — Sale',
    category: 'Keyboards',
    vendor: '1upKeyboards',
  },
};

/**
 * Scrape a built-in source by its source ID.
 * Returns [] if no rule is registered for the given ID.
 */
async function scrapeBuiltinSource(sourceId, mode = 'scheduled') {
  const rule = BUILTIN_SOURCE_RULES[sourceId];
  if (!rule) return [];
  return runSource(rule, mode);
}

// ─── Legacy stubs (backward-compat with existing cron wiring) ─────────────────

async function scrapeAdafruit() {
  return { newest: [], sales: [] };
}

async function scrapeUserDigikey(userTracked) {
  return userTracked.map(item => ({ ...item, data: [] }));
}

async function scrapeUserMouser(userTracked) {
  return userTracked.map(item => ({ ...item, data: [] }));
}

async function updateCache() {
  let userWatchlists = {};
  try {
    userWatchlists = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'userWatchlists.json'), 'utf-8')
    );
  } catch {
    console.warn('updateCache: could not read userWatchlists.json, skipping');
    return;
  }
  for (const userId in userWatchlists) {
    const digikeyData  = await scrapeUserDigikey(userWatchlists[userId].digikey || []);
    const mouserData   = await scrapeUserMouser(userWatchlists[userId].mouser   || []);
    const adafruitData = await scrapeAdafruit();
    const cache = { digikey: digikeyData, mouser: mouserData, adafruit: adafruitData, updated: new Date() };
    fs.writeFileSync(
      path.join(__dirname, `cache_${userId}.json`),
      JSON.stringify(cache, null, 2)
    );
    await sleep(INTER_REQUEST_DELAY_MS);
  }
}

module.exports = {
  BUILTIN_SOURCE_RULES,
  runSource, testRule, scratchBatch, scrapeBuiltinSource,
  scrapeHtml, scrapeJson, scrapeJsonMulti,
  scrapeAdafruit, scrapeUserDigikey, scrapeUserMouser, updateCache,
};
