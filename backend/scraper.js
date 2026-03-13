// backend/scraper.js
// Node.js backend for periodic scraping and caching — with anti-abuse guards

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const cheerio = require('cheerio');
const { JSONPath } = require('jsonpath-plus');

/** In-process OAuth2 token cache for Digikey. Keyed by sha256(clientId).slice(0,16). */
const digikeyTokenCache = new Map(); // key → { token: string, expiresAt: number }

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

/**
 * Text signals used as a fallback to infer stock status from variant/product titles.
 * These patterns are checked when Shopify is NOT actively tracking inventory
 * (inventory_management is null/absent — typical in group buys, MTO, pre-orders).
 * OOS_TITLE_PATTERNS wins over IN_STOCK_TITLE_PATTERNS if both hypothetically match.
 */
const OOS_TITLE_PATTERNS = /\b(?:group\s*buy\s*ended?|gb\s*ended?|sale\s*ended?|ic\s*ended?|interest\s*check\s*ended?|sold\s*out|out\s*of\s*stock|no\s*longer\s*available|discontinued|closed|ended)\b/i;
const IN_STOCK_TITLE_PATTERNS = /\b(?:in\s*stock|available\s*now|ships?\s*now|ready\s*to\s*ship|rts|buy\s*now)\b/i;

/**
 * Classify a variant title using text signals.
 * @returns {'available'|'unavailable'|'unknown'}
 */
function classifyVariantByText(title = '') {
  if (OOS_TITLE_PATTERNS.test(title)) return 'unavailable';
  if (IN_STOCK_TITLE_PATTERNS.test(title)) return 'available';
  return 'unknown';
}

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
    // Auto-extract Shopify inventory when variants are present.
    //
    // Priority chain for stock status:
    //   1. Shopify-managed variants (inventory_management === 'shopify') — authoritative
    //   2. Text-signal fallback — classify unmanaged variant titles for group-buy/MTO items
    //   3. Product-level OOS title check — last resort when no classifiable variants exist
    //
    // Stock tiers (based on % of deterministic variants that are available):
    //   anyAvailable=false           → Out of Stock  (0% available)
    //   lowStock=true                → Low Stock     (<25% available)
    //   partialStock=true            → Limited Stock  (25–50% available)
    //   else                         → In Stock      (>50% available)
    if (container.variants && Array.isArray(container.variants) && container.variants.length > 0) {
      const shopifyTracked = container.variants.filter(v => v.inventory_management === 'shopify');
      const variantDetails = [];

      if (shopifyTracked.length > 0) {
        // ── 1. Shopify managed — uses quantity/policy data ─────────────────────
        const shopifyAvailable = shopifyTracked.filter(v =>
          v.inventory_policy === 'continue' || (parseInt(v.inventory_quantity, 10) || 0) > 0
        );
        const availRatio = shopifyAvailable.length / shopifyTracked.length;
        const anyAvailable = shopifyAvailable.length > 0;
        const lowStock = anyAvailable && availRatio < 0.25;
        const partialStock = anyAvailable && !lowStock && availRatio <= 0.5;

        obj.anyAvailable   = anyAvailable  ? 'true' : 'false';
        obj.lowStock       = lowStock      ? 'true' : 'false';
        obj.partialStock   = partialStock  ? 'true' : 'false';
        obj.variantCount   = String(shopifyTracked.length);
        obj.availableCount = String(shopifyAvailable.length);
        const totalQty = shopifyTracked.reduce((acc, v) => acc + (parseInt(v.inventory_quantity, 10) || 0), 0);
        if (totalQty > 0) obj.totalInventory = String(totalQty);

        for (const v of shopifyTracked) {
          const qty = parseInt(v.inventory_quantity, 10) || 0;
          const available = v.inventory_policy === 'continue' || qty > 0;
          const detail = { title: v.title || 'Default', available, source: 'shopify' };
          if (v.price) detail.price = v.price;
          if (qty > 0) detail.qty = qty;
          variantDetails.push(detail);
        }
      } else {
        // ── 2. Text-signal fallback for unmanaged variants ─────────────────────
        const textTracked = [];
        for (const v of container.variants) {
          const classification = classifyVariantByText(v.title);
          if (classification === 'unknown') continue;
          const available = classification === 'available';
          const detail = { title: v.title || 'Default', available, source: 'text' };
          if (v.price) detail.price = v.price;
          textTracked.push(detail);
          variantDetails.push(detail);
        }

        if (textTracked.length > 0) {
          const availCount = textTracked.filter(d => d.available).length;
          const availRatio = availCount / textTracked.length;
          const anyAvailable = availCount > 0;
          const lowStock = anyAvailable && availRatio < 0.25;
          const partialStock = anyAvailable && !lowStock && availRatio <= 0.5;

          obj.anyAvailable   = anyAvailable ? 'true' : 'false';
          obj.lowStock       = lowStock     ? 'true' : 'false';
          obj.partialStock   = partialStock ? 'true' : 'false';
          obj.variantCount   = String(textTracked.length);
          obj.availableCount = String(availCount);
        } else {
          // ── 3. Product title/tags OOS check (last resort) ──────────────────
          const productText = [
            container.title || '',
            Array.isArray(container.tags) ? container.tags.join(' ') : (container.tags || ''),
          ].join(' ');
          if (OOS_TITLE_PATTERNS.test(productText)) {
            obj.anyAvailable = 'false';
          }
        }
      }

      if (variantDetails.length > 0) obj._variants = variantDetails;

      // Price range across ALL variants (not just tracked ones)
      const prices = container.variants
        .map(v => parseFloat(v.price))
        .filter(p => p > 0);
      if (prices.length > 0) {
        obj.priceMin = String(Math.min(...prices));
        obj.priceMax = String(Math.max(...prices));
      }

      // Detect item type from product_type, tags, or variant titles
      const ptype = (container.product_type || '').toLowerCase();
      const tagStr = (Array.isArray(container.tags) ? container.tags.join(' ') : (container.tags || '')).toLowerCase();
      const variantTitles = container.variants.map(v => (v.title || '').toLowerCase()).join(' ');
      const combined = `${ptype} ${tagStr} ${variantTitles}`;
      const itemType =
        /\bkit\b|keyboard kit|diy/i.test(combined) ? 'Kit' :
        /\bassembled\b|pre.?built|fully built|built/i.test(combined) ? 'Pre-built' :
        /\bbarebones?\b|case only/i.test(combined) ? 'Barebones' :
        /\bpcb\b/i.test(combined) ? 'PCB' :
        /\bplate\b/i.test(combined) ? 'Plate' :
        /\bkeycap/i.test(combined) ? 'Keycaps' :
        /\bswitch/i.test(combined) ? 'Switches' :
        /\bdeskmats?\b|desk.?mat/i.test(combined) ? 'Deskmat' :
        undefined;
      if (itemType) obj.itemType = itemType;
    }
    // Build absolute product URL from handle if baseUrl provided
    if (baseUrl && obj.handle) obj.url = baseUrl + obj.handle;
    // Only include items that have at least a name
    if (obj.name) results.push(obj);
  }
  return results;
}

/**
 * Lightweight fetch for RSS/Atom feeds — concurrency-capped but NOT subject to
 * the HTML-scraping per-host cooldown. RSS is designed for frequent polling.
 */
async function rssFetch(url) {
  const hostname = getHostname(url);
  await acquireSlot(hostname);
  try {
    const response = await axios.get(url, {
      timeout: REQUEST_TIMEOUT_MS,
      responseType: 'text',
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'application/rss+xml, application/atom+xml, text/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (response.status >= 400) throw new Error(`HTTP ${response.status} from ${hostname}`);
    return response.data;
  } finally {
    releaseSlot(hostname);
  }
}

/**
 * Parse an RSS/Atom feed. Extracts title, link, price (from description regex or media),
 * and optional image from media:thumbnail or enclosure.
 */
async function scrapeRss({ url, priceRegex }, _mode = 'scheduled') {
  const xml = await rssFetch(url);
  const $ = cheerio.load(xml, { xmlMode: true });
  const results = [];
  $('item, entry').each((_, el) => {
    const name  = $(el).find('title').first().text().trim();
    const link  = $(el).find('link').first().text().trim() ||
                  $(el).find('link').first().attr('href') || '';
    const desc  = $(el).find('description, summary, content').first().text();
    // Try to pull a price out of the description text
    const re    = priceRegex ? new RegExp(priceRegex) : /\$([0-9,]+(?:\.[0-9]{1,2})?)/;
    const pm    = desc.match(re);
    const price = pm ? pm[0].replace(/[^0-9.]/g, '') : undefined;
    // Image from media:thumbnail, media:content, or enclosure
    const image = $(el).find('media\\:thumbnail, media\\:content').first().attr('url') ||
                  $(el).find('enclosure[type^="image"]').first().attr('url') || undefined;
    if (name) results.push({ name, url: link || undefined, price, image });
  });
  return results;
}

/**
 * Amazon Product Advertising API 5.0 — SearchItems.
 * Requires context.apiKeys: { amazonAccessKey, amazonSecretKey, amazonPartnerTag }.
 * Returns [] silently if any key is missing.
 */
async function scrapeAmazonApi({ keywords, searchIndex = 'Electronics' }, _mode, context = {}) {
  const { amazonAccessKey, amazonSecretKey, amazonPartnerTag } = context.apiKeys ?? {};
  if (!amazonAccessKey || !amazonSecretKey || !amazonPartnerTag) return [];

  const crypto = require('crypto');
  const HOST   = 'webservices.amazon.com';
  const REGION = 'us-east-1';
  const SERVICE = 'ProductAdvertisingAPI';
  const PATH   = '/paapi5/searchitems';

  const now    = new Date();
  const date   = now.toISOString().replace(/[:-]/g, '').split('.')[0] + 'Z';
  const dateOnly = date.slice(0, 8);

  const payload = JSON.stringify({
    Keywords: keywords,
    Resources: ['ItemInfo.Title', 'Offers.Listings.Price', 'Images.Primary.Medium'],
    SearchIndex: searchIndex,
    PartnerTag: amazonPartnerTag,
    PartnerType: 'Associates',
    Marketplace: 'www.amazon.com',
    ItemCount: 10,
  });

  const payloadHash = crypto.createHash('sha256').update(payload).digest('hex');
  const canonicalHeaders = `content-encoding:amz-1.0\ncontent-type:application/json; charset=utf-8\nhost:${HOST}\nx-amz-date:${date}\nx-amz-target:com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems\n`;
  const signedHeaders = 'content-encoding;content-type;host;x-amz-date;x-amz-target';
  const canonicalRequest = `POST\n${PATH}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const credScope = `${dateOnly}/${REGION}/${SERVICE}/aws4_request`;
  const strToSign = `AWS4-HMAC-SHA256\n${date}\n${credScope}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;

  function hmac(key, data) { return crypto.createHmac('sha256', key).update(data).digest(); }
  const sigKey = hmac(hmac(hmac(hmac('AWS4' + amazonSecretKey, dateOnly), REGION), SERVICE), 'aws4_request');
  const signature = hmac(sigKey, strToSign).toString('hex');

  const authorization = `AWS4-HMAC-SHA256 Credential=${amazonAccessKey}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const hostname = HOST;
  await acquireSlot(hostname);
  try {
    recordScrape(hostname);
    const axios = require('axios');
    const resp = await axios.post(`https://${HOST}${PATH}`, payload, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        'content-encoding': 'amz-1.0',
        'content-type': 'application/json; charset=utf-8',
        host: HOST,
        'x-amz-date': date,
        'x-amz-target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems',
        Authorization: authorization,
      },
    });
    return (resp.data?.SearchResult?.Items ?? []).map(item => ({
      name:  item.ItemInfo?.Title?.DisplayValue ?? '',
      url:   item.DetailPageURL ?? undefined,
      price: item.Offers?.Listings?.[0]?.Price?.Amount?.toString() ?? undefined,
      image: item.Images?.Primary?.Medium?.URL ?? undefined,
    })).filter(i => i.name);
  } finally {
    releaseSlot(hostname);
  }
}

/**
 * Newegg search JSON API — public, no key required, but respects per-host cooldown.
 * Optional context.apiKeys.neweggApiKey reserved for future affiliate API use.
 */
async function scrapeNeweggJson({ keywords, categoryId }, mode = 'scheduled') {
  // Newegg's internal search API (public, unauthenticated)
  const params = new URLSearchParams({ keyword: keywords, pageSize: '20', pageIndex: '1' });
  if (categoryId) params.set('N', categoryId);
  const url = `https://www.newegg.com/p/pl?${params.toString()}&ajax=1`;
  const data = await guardedFetch(url, mode, 'json').catch(() => null);
  if (!data) return [];
  const products = data?.Filters?.ProductList ?? data?.ProductList ?? [];
  return products.slice(0, 20).map(p => ({
    name:  p.Title ?? p.Description ?? '',
    url:   p.ProductLink ? `https://www.newegg.com${p.ProductLink}` : undefined,
    price: p.UnitPrice ? String(p.UnitPrice) : undefined,
    image: p.ThumbnailImageUrl ?? undefined,
  })).filter(i => i.name);
}

/**
 * Validate a user-supplied URL against SSRF risks.
 * Rejects: non-http/https schemes, localhost, loopback, link-local, and
 * RFC-1918 private ranges (10/8, 172.16/12, 192.168/16).
 * Throws an Error with a safe message if the URL is not allowed.
 */
function validateUserRssUrl(rawUrl) {
  let parsed;
  try { parsed = new URL(rawUrl); } catch {
    throw new Error('Invalid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https URLs are allowed');
  }
  const host = parsed.hostname.toLowerCase();
  // Reject localhost variants
  if (host === 'localhost' || host === '0.0.0.0' || host === '::1') {
    throw new Error('URL resolves to a private or internal address');
  }
  // Reject IPv4 literals in private/loopback ranges
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [, a, b] = ipv4.map(Number);
    if (a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) {
      throw new Error('URL resolves to a private or internal address');
    }
  }
  return parsed.toString();
}


function applyPostFilter(items, postFilter) {
  if (!postFilter) return items;
  const { requireAny = [], excludeAny = [] } = postFilter;
  return items.filter(item => {
    const name = (item.name ?? '').toLowerCase();
    if (requireAny.length > 0 && !requireAny.some(t => name.includes(t.toLowerCase()))) return false;
    if (excludeAny.some(t => name.includes(t.toLowerCase()))) return false;
    return true;
  });
}

/**
 * Registry of ruleType → handler functions.
 * Each handler receives (opts, mode, context) and returns a Promise<item[]>.
 * Add new source types here without touching runSource().
 *
 * Built-in types:
 *   css              — Cheerio multi-field HTML scraping (scrapeHtml)
 *   jsonpath         — Single-field JSONPath extraction (scrapeJson)
 *   jsonpath-multi   — Multi-field per container, preferred for Shopify products.json (scrapeJsonMulti)
 *   rss              — RSS/Atom feeds (scrapeRss)
 *   amazon-api       — Amazon PA API 5.0, requires context.apiKeys (scrapeAmazonApi)
 *   newegg-search-api— Newegg public JSON search API, no key needed (scrapeNeweggJson)
 *   user-rss         — User-supplied RSS URL; validated against SSRF before fetching (Phase 3)
 *   digikey-api      — Digikey Product Search API v4, OAuth2 CC flow (Phase 4)
 *   mouser-api       — Mouser Search API v2; NO caching per Mouser ToS §4 (Phase 4)
 *   webhook-buffer   — Reads Redis ring buffer for a webhook source (Phase 5)
 *   manual-list      — Reads user-curated items from Postgres (Phase 6)
 */
const RULE_TYPE_HANDLERS = {
  'css':              (opts, mode)          => scrapeHtml(opts, mode),
  'jsonpath':         (opts, mode)          => scrapeJson(opts, mode),
  'jsonpath-multi':   (opts, mode)          => scrapeJsonMulti(opts, mode),
  'rss':              (opts, mode)          => scrapeRss(opts, mode),
  'amazon-api':       (opts, mode, context) => scrapeAmazonApi(opts, mode, context),
  'newegg-search-api':(opts, mode)          => scrapeNeweggJson(opts, mode),
  // user-rss: user-supplied RSS/Atom URL. SSRF-validated before fetching.
  // Cache key in feedConfig: feed:v4:source:user-rss:{sha256(url)} — same 6h TTL.
  'user-rss': (opts, mode) => {
    validateUserRssUrl(opts.url); // throws if unsafe
    return scrapeRss(opts, mode);
  },
  // digikey-api: OAuth2 CC flow; token cached in-process; result cached 6h in feedConfig.
  'digikey-api': (opts, mode, context) => scrapeDigikeyApi(opts, mode, context),
  // mouser-api: simple API key; NO source cache per Mouser ToS §4 (feedConfig bypasses cache).
  'mouser-api':  (opts, mode, context) => scrapeMouserApi(opts, mode, context),
  // webhook-buffer: reads the Redis ring buffer populated by inbound POST /api/webhooks/:id/ingest.
  // No HTTP fetch — reads local Redis only. feedConfig bypasses source cache.
  'webhook-buffer': async (opts) => {
    if (!opts.webhookId) throw new Error('webhook-buffer requires opts.webhookId');
    const redisClient = require('./redis');
    const key = `webhook:buffer:${opts.webhookId}`;
    let raw;
    try { raw = await redisClient.lrange(key, 0, -1); } catch { raw = []; }
    return raw.map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
  },
  // manual-list: reads user-curated items from the manual_list_items Postgres table.
  // No HTTP fetch. feedConfig bypasses source cache.
  'manual-list': async (opts, _mode, context) => {
    if (!opts.listId) throw new Error('manual-list requires opts.listId');
    if (!context.userId) throw new Error('manual-list requires context.userId');
    const dbClient = require('./db');
    const result = await dbClient.query(
      `SELECT id, name, url, price, image, notes, sort_order, created_at, updated_at
       FROM manual_list_items
       WHERE user_id=$1 AND list_id=$2
       ORDER BY sort_order ASC, created_at ASC`,
      [context.userId, opts.listId]
    );
    return result.rows.map(r => ({
      id:         r.id,
      name:       r.name,
      url:        r.url        ?? undefined,
      price:      r.price      ?? undefined,
      image:      r.image      ?? undefined,
      notes:      r.notes      ?? undefined,
      sortOrder:  r.sort_order,
      createdAt:  r.created_at,
      updatedAt:  r.updated_at,
    }));
  },
};

/** Route a rule to the correct scraper by ruleType. New types register in RULE_TYPE_HANDLERS. */
async function runSource(opts, mode = 'scheduled', context = {}) {
  const handler = RULE_TYPE_HANDLERS[opts.ruleType];
  if (!handler) {
    throw new Error(`Unknown ruleType: "${opts.ruleType}". Registered types: ${Object.keys(RULE_TYPE_HANDLERS).join(', ')}`);
  }
  const results = await handler(opts, mode, context);
  return applyPostFilter(results, opts.postFilter);
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
    containerSelector: 'a.productClickItemV2',
    fields: [
      { selector: null,              fieldName: 'name',  attribute: 'data-name' },
      { selector: null,              fieldName: 'url',   attribute: 'href' },
      { selector: null,              fieldName: 'price', attribute: 'data-price' },
      { selector: 'img.img-100',     fieldName: 'image', attribute: 'src' },
    ],
    label: 'Microcenter — Memory',
  },
  'microcenter-gpu': {
    url: 'https://www.microcenter.com/category/4294966937/video-cards',
    ruleType: 'css',
    containerSelector: 'a.productClickItemV2',
    fields: [
      { selector: null,              fieldName: 'name',  attribute: 'data-name' },
      { selector: null,              fieldName: 'url',   attribute: 'href' },
      { selector: null,              fieldName: 'price', attribute: 'data-price' },
      { selector: 'img.img-100',     fieldName: 'image', attribute: 'src' },
    ],
    label: 'Microcenter — Video Cards',
  },
  'microcenter-keyboards': {
    url: 'https://www.microcenter.com/category/4294966635/keyboards',
    ruleType: 'css',
    containerSelector: 'a.productClickItemV2',
    fields: [
      { selector: null,              fieldName: 'name',  attribute: 'data-name' },
      { selector: null,              fieldName: 'url',   attribute: 'href' },
      { selector: null,              fieldName: 'price', attribute: 'data-price' },
      { selector: 'img.img-100',     fieldName: 'image', attribute: 'src' },
    ],
    label: 'Microcenter — Keyboards',
  },
  'microcenter-electronics': {
    url: 'https://www.microcenter.com/category/4294966773/development-boards-kits',
    ruleType: 'css',
    containerSelector: 'a.productClickItemV2',
    fields: [
      { selector: null,              fieldName: 'name',  attribute: 'data-name' },
      { selector: null,              fieldName: 'url',   attribute: 'href' },
      { selector: null,              fieldName: 'price', attribute: 'data-price' },
      { selector: 'img.img-100',     fieldName: 'image', attribute: 'src' },
    ],
    label: 'Microcenter — Dev Boards & Kits',
    vendor: 'Microcenter',
    category: 'Electronics',
  },

  // ─── Electronics / maker vendors ──────────────────────────────────────────────

  'adafruit-new': {
    url: 'https://www.adafruit.com/new/rss.xml',
    ruleType: 'rss',
    label: 'Adafruit — New Products',
    vendor: 'Adafruit',
    category: 'Electronics',
  },
  'adafruit-microcontrollers': {
    url: 'https://www.adafruit.com/collections/microcontrollers/products.json?limit=50',
    ruleType: 'jsonpath-multi',
    containerPath: '$.products[*]',
    fields: [
      { path: '$.title',               fieldName: 'name' },
      { path: '$.images[0].src',       fieldName: 'image' },
      { path: '$.variants[0].price',   fieldName: 'price' },
      { path: '$.handle',              fieldName: 'handle' },
      { path: '$.product_type',        fieldName: 'productType' },
      { path: '$.tags',                fieldName: 'tags' },
    ],
    baseUrl: 'https://www.adafruit.com/product/',
    label: 'Adafruit — Microcontrollers',
    vendor: 'Adafruit',
    category: 'Electronics',
  },
  'adafruit-sensors': {
    url: 'https://www.adafruit.com/collections/sensors-camera/products.json?limit=50',
    ruleType: 'jsonpath-multi',
    containerPath: '$.products[*]',
    fields: [
      { path: '$.title',               fieldName: 'name' },
      { path: '$.images[0].src',       fieldName: 'image' },
      { path: '$.variants[0].price',   fieldName: 'price' },
      { path: '$.handle',              fieldName: 'handle' },
      { path: '$.product_type',        fieldName: 'productType' },
      { path: '$.tags',                fieldName: 'tags' },
    ],
    baseUrl: 'https://www.adafruit.com/product/',
    label: 'Adafruit — Sensors',
    vendor: 'Adafruit',
    category: 'Electronics',
  },
  'adafruit-motors': {
    url: 'https://www.adafruit.com/collections/motors-steppers-servos/products.json?limit=50',
    ruleType: 'jsonpath-multi',
    containerPath: '$.products[*]',
    fields: [
      { path: '$.title',               fieldName: 'name' },
      { path: '$.images[0].src',       fieldName: 'image' },
      { path: '$.variants[0].price',   fieldName: 'price' },
      { path: '$.handle',              fieldName: 'handle' },
      { path: '$.product_type',        fieldName: 'productType' },
      { path: '$.tags',                fieldName: 'tags' },
    ],
    baseUrl: 'https://www.adafruit.com/product/',
    label: 'Adafruit — Motors & Servos',
    vendor: 'Adafruit',
    category: 'Electronics',
  },
  'adafruit-passives': {
    url: 'https://www.adafruit.com/collections/components/products.json?limit=50',
    ruleType: 'jsonpath-multi',
    containerPath: '$.products[*]',
    fields: [
      { path: '$.title',               fieldName: 'name' },
      { path: '$.images[0].src',       fieldName: 'image' },
      { path: '$.variants[0].price',   fieldName: 'price' },
      { path: '$.handle',              fieldName: 'handle' },
      { path: '$.product_type',        fieldName: 'productType' },
      { path: '$.tags',                fieldName: 'tags' },
    ],
    baseUrl: 'https://www.adafruit.com/product/',
    label: 'Adafruit — Passives & Components',
    vendor: 'Adafruit',
    category: 'Electronics',
  },
  'adafruit-breakout-boards': {
    url: 'https://www.adafruit.com/collections/breakout-boards/products.json?limit=50',
    ruleType: 'jsonpath-multi',
    containerPath: '$.products[*]',
    fields: [
      { path: '$.title',               fieldName: 'name' },
      { path: '$.images[0].src',       fieldName: 'image' },
      { path: '$.variants[0].price',   fieldName: 'price' },
      { path: '$.handle',              fieldName: 'handle' },
      { path: '$.product_type',        fieldName: 'productType' },
      { path: '$.tags',                fieldName: 'tags' },
    ],
    baseUrl: 'https://www.adafruit.com/product/',
    label: 'Adafruit — Breakout Boards',
    vendor: 'Adafruit',
    category: 'Electronics',
  },
  'adafruit-sales': {
    url: 'https://www.adafruit.com/collections/sale/products.json?limit=50',
    ruleType: 'jsonpath-multi',
    containerPath: '$.products[*]',
    fields: [
      { path: '$.title',               fieldName: 'name' },
      { path: '$.images[0].src',       fieldName: 'image' },
      { path: '$.variants[0].price',   fieldName: 'price' },
      { path: '$.variants[0].compare_at_price', fieldName: 'comparePrice' },
      { path: '$.handle',              fieldName: 'handle' },
      { path: '$.product_type',        fieldName: 'productType' },
      { path: '$.tags',                fieldName: 'tags' },
    ],
    baseUrl: 'https://www.adafruit.com/product/',
    label: 'Adafruit — Sales',
    vendor: 'Adafruit',
    category: 'Electronics',
  },

  // ─── RAM vendors ──────────────────────────────────────────────────────────────
  // Consumer RAM sources. Amazon uses the PA API (keys must be set in app settings).
  // Newegg uses the public JSON search API (no key needed).
  // B&H uses their public search HTML. Reddit + CamelCamelCamel use public RSS feeds.

  'newegg-ram': {
    // N=100007611 restricts to the DRAM product type facet within Desktop Memory,
    // filtering out flash storage and SD cards that Newegg co-lists in SubCategory/ID-147.
    url: 'https://www.newegg.com/Desktop-Memory/SubCategory/ID-147?N=100007611',
    ruleType: 'css',
    containerSelector: 'div.item-cell',
    fields: [
      { selector: 'a.item-title',        fieldName: 'name' },
      { selector: 'a.item-title',        fieldName: 'url',   attribute: 'href' },
      { selector: 'a.item-img img',      fieldName: 'image', attribute: 'src' },
      { selector: 'li.price-current',    fieldName: 'price' },
    ],
    label: 'Newegg — RAM',
    vendor: 'Newegg',
    category: 'RAM',
    postFilter: {
      requireAny: ['DDR3', 'DDR4', 'DDR5', 'LPDDR', 'DIMM'],
      excludeAny: ['SSD', 'NVMe', 'hard drive', 'hard disk', 'HDD', 'SD Card', 'microSD', 'Micro SD', 'flash drive', 'CompactFlash', 'eMMC'],
    },
  },
  'amazon-ram': {
    ruleType: 'amazon-api',
    keywords: 'DDR5 DDR4 desktop RAM memory',
    searchIndex: 'Electronics',
    label: 'Amazon — RAM',
    vendor: 'Amazon',
    category: 'RAM',
    postFilter: {
      requireAny: ['DDR3', 'DDR4', 'DDR5', 'LPDDR', 'DIMM'],
      excludeAny: ['SSD', 'NVMe', 'hard drive', 'hard disk', 'HDD', 'SD Card', 'microSD', 'Micro SD', 'flash drive', 'CompactFlash', 'eMMC'],
    },
  },
  // TigerDirect removed — site retired in 2024 (tigerdirect.com redirects to notice page).
  // B&H Photo removed — returns HTTP 403 for automated requests.
  'reddit-ram': {
    url: 'https://www.reddit.com/r/buildapcsales/search.rss?q=flair%3AMemory&sort=new&restrict_sr=1&limit=25',
    ruleType: 'rss',
    label: 'r/buildapcsales — Memory',
    vendor: 'Reddit',
    category: 'RAM',
    postFilter: {
      requireAny: ['DDR3', 'DDR4', 'DDR5', 'LPDDR', 'DIMM'],
      excludeAny: ['SSD', 'NVMe', 'hard drive', 'hard disk', 'HDD', 'SD Card', 'microSD', 'Micro SD', 'flash drive', 'CompactFlash', 'eMMC'],
    },
  },
  'camelcamel-ram': {
    url: 'https://camelcamelcamel.com/top_drops/usd/daily/10/Memory.rss',
    ruleType: 'rss',
    label: 'CamelCamelCamel — Memory Price Drops',
    vendor: 'CamelCamelCamel',
    category: 'RAM',
    postFilter: {
      requireAny: ['DDR3', 'DDR4', 'DDR5', 'LPDDR', 'DIMM'],
      excludeAny: ['SSD', 'NVMe', 'hard drive', 'hard disk', 'HDD', 'SD Card', 'microSD', 'Micro SD', 'flash drive', 'CompactFlash', 'eMMC'],
    },
  },

  // ─── GPU vendors ──────────────────────────────────────────────────────────────

  'newegg-gpu': {
    url: 'https://www.newegg.com/Desktop-Graphics-Cards/SubCategory/ID-48',
    ruleType: 'css',
    containerSelector: 'div.item-cell',
    fields: [
      { selector: 'a.item-title',        fieldName: 'name' },
      { selector: 'a.item-title',        fieldName: 'url',   attribute: 'href' },
      { selector: 'a.item-img img',      fieldName: 'image', attribute: 'src' },
      { selector: 'li.price-current',    fieldName: 'price' },
    ],
    label: 'Newegg — GPUs',
    vendor: 'Newegg',
    category: 'GPU',
  },
  'amazon-gpu': {
    ruleType: 'amazon-api',
    keywords: 'NVIDIA AMD GPU graphics card RTX RX',
    searchIndex: 'Electronics',
    label: 'Amazon — GPUs',
    vendor: 'Amazon',
    category: 'GPU',
  },
  // TigerDirect removed — site retired in 2024.
  // B&H Photo removed — returns HTTP 403 for automated requests.
  'reddit-gpu': {
    url: 'https://www.reddit.com/r/buildapcsales/search.rss?q=flair%3A%22Video+Card%22&sort=new&restrict_sr=1&limit=25',
    ruleType: 'rss',
    label: 'r/buildapcsales — Video Cards',
    vendor: 'Reddit',
    category: 'GPU',
  },
  'camelcamel-gpu': {
    url: 'https://camelcamelcamel.com/top_drops/usd/daily/10/Video_Cards.rss',
    ruleType: 'rss',
    label: 'CamelCamelCamel — GPU Price Drops',
    vendor: 'CamelCamelCamel',
    category: 'GPU',
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
      { path: '$.product_type',        fieldName: 'productType' },
      { path: '$.tags',                fieldName: 'tags' },
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
      { path: '$.product_type',        fieldName: 'productType' },
      { path: '$.tags',                fieldName: 'tags' },
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
      { path: '$.product_type',        fieldName: 'productType' },
      { path: '$.tags',                fieldName: 'tags' },
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
      { path: '$.product_type',        fieldName: 'productType' },
      { path: '$.tags',                fieldName: 'tags' },
    ],
    baseUrl: 'https://www.1upkeyboards.com/products/',
    label: '1upKeyboards — Keyboard Kits',
    category: 'Keyboards',
    vendor: '1upKeyboards',
  },
  'keeb-io-keyboards': {
    url: 'https://keeb.io/collections/keyboards/products.json?limit=50',
    ruleType: 'jsonpath-multi',
    containerPath: '$.products[*]',
    fields: [
      { path: '$.title',               fieldName: 'name' },
      { path: '$.images[0].src',       fieldName: 'image' },
      { path: '$.variants[0].price',   fieldName: 'price' },
      { path: '$.handle',              fieldName: 'handle' },
      { path: '$.product_type',        fieldName: 'productType' },
      { path: '$.tags',                fieldName: 'tags' },
    ],
    baseUrl: 'https://keeb.io/products/',
    label: 'Keeb.io — Keyboards',
    category: 'Keyboards',
    vendor: 'Keebio',
  },
  'stupidbulletstech-keyboards': {
    url: 'https://stupidbulletstech.com/collections/keyboards-and-cases/products.json?limit=50',
    ruleType: 'jsonpath-multi',
    containerPath: '$.products[*]',
    fields: [
      { path: '$.title',               fieldName: 'name' },
      { path: '$.images[0].src',       fieldName: 'image' },
      { path: '$.variants[0].price',   fieldName: 'price' },
      { path: '$.handle',              fieldName: 'handle' },
      { path: '$.product_type',        fieldName: 'productType' },
      { path: '$.tags',                fieldName: 'tags' },
    ],
    baseUrl: 'https://stupidbulletstech.com/products/',
    label: 'Stupid Bullets Tech — Keyboards & Cases',
    category: 'Keyboards',
    vendor: 'Stupid Bullets Tech',
  },
  'stupidbulletstech-accessories': {
    url: 'https://stupidbulletstech.com/collections/keyboard-building-accessories/products.json?limit=50',
    ruleType: 'jsonpath-multi',
    containerPath: '$.products[*]',
    fields: [
      { path: '$.title',               fieldName: 'name' },
      { path: '$.images[0].src',       fieldName: 'image' },
      { path: '$.variants[0].price',   fieldName: 'price' },
      { path: '$.handle',              fieldName: 'handle' },
    ],
    baseUrl: 'https://stupidbulletstech.com/products/',
    label: 'Stupid Bullets Tech — Building Accessories',
    category: 'Accessories',
    vendor: 'Stupid Bullets Tech',
  },
  'stupidbulletstech-garage-sale': {
    url: 'https://stupidbulletstech.com/collections/garage-sale-items/products.json?limit=50',
    ruleType: 'jsonpath-multi',
    containerPath: '$.products[*]',
    fields: [
      { path: '$.title',               fieldName: 'name' },
      { path: '$.images[0].src',       fieldName: 'image' },
      { path: '$.variants[0].price',   fieldName: 'price' },
      { path: '$.variants[0].compare_at_price', fieldName: 'comparePrice' },
      { path: '$.handle',              fieldName: 'handle' },
    ],
    baseUrl: 'https://stupidbulletstech.com/products/',
    label: 'Stupid Bullets Tech — Garage Sale',
    category: 'Sale',
    vendor: 'Stupid Bullets Tech',
  },

  'stupidbulletstech-keycaps': {
    url: 'https://stupidbulletstech.com/collections/cap-of-the-month-1-unfuc-k/products.json?limit=50',
    ruleType: 'jsonpath-multi',
    containerPath: '$.products[*]',
    fields: [
      { path: '$.title',               fieldName: 'name' },
      { path: '$.images[0].src',       fieldName: 'image' },
      { path: '$.variants[0].price',   fieldName: 'price' },
      { path: '$.handle',              fieldName: 'handle' },
    ],
    baseUrl: 'https://stupidbulletstech.com/products/',
    label: 'Stupid Bullets Tech — Artisan Keycaps',
    category: 'Keycaps',
    vendor: 'Stupid Bullets Tech',
  },
  'stupidbulletstech-switches': {
    url: 'https://stupidbulletstech.com/collections/accessories/products.json?limit=50',
    ruleType: 'jsonpath-multi',
    containerPath: '$.products[*]',
    fields: [
      { path: '$.title',               fieldName: 'name' },
      { path: '$.images[0].src',       fieldName: 'image' },
      { path: '$.variants[0].price',   fieldName: 'price' },
      { path: '$.handle',              fieldName: 'handle' },
      { path: '$.tags',                fieldName: 'tags' },
    ],
    baseUrl: 'https://stupidbulletstech.com/products/',
    label: 'Stupid Bullets Tech — Switches',
    category: 'Switches',
    vendor: 'Stupid Bullets Tech',
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
  'customkeysco-switches': {
    url: 'https://www.customkeysco.com/products.json?limit=50',
    ruleType: 'jsonpath-multi',
    containerPath: '$[*]',
    fields: [
      { path: '$.name',                fieldName: 'name' },
      { path: '$.images[0].url',       fieldName: 'image' },
      { path: '$.price',               fieldName: 'price' },
      { path: '$.permalink',           fieldName: 'handle' },
      { path: '$.categories[0].name',  fieldName: 'productType' },
      { path: '$.status',              fieldName: 'status' },
    ],
    baseUrl: 'https://www.customkeysco.com/product/',
    label: 'Custom Keys Co — Switches & Accessories',
    category: 'Switches',
    vendor: 'Custom Keys Co',
  },

  'customkeysco-keyboards': {
    url: 'https://www.customkeysco.com/products.json?limit=50',
    ruleType: 'jsonpath-multi',
    containerPath: '$[*]',
    fields: [
      { path: '$.name',                fieldName: 'name' },
      { path: '$.images[0].url',       fieldName: 'image' },
      { path: '$.price',               fieldName: 'price' },
      { path: '$.permalink',           fieldName: 'handle' },
      { path: '$.categories[0].name',  fieldName: 'productType' },
    ],
    baseUrl: 'https://www.customkeysco.com/product/',
    label: 'Custom Keys Co — Keyboards & Accessories',
    category: 'Keyboards',
    vendor: 'Custom Keys Co',
  },
  'customkeysco-keycaps': {
    url: 'https://www.customkeysco.com/products.json?limit=50',
    ruleType: 'jsonpath-multi',
    containerPath: '$[*]',
    fields: [
      { path: '$.name',                fieldName: 'name' },
      { path: '$.images[0].url',       fieldName: 'image' },
      { path: '$.price',               fieldName: 'price' },
      { path: '$.permalink',           fieldName: 'handle' },
      { path: '$.categories[0].name',  fieldName: 'productType' },
    ],
    baseUrl: 'https://www.customkeysco.com/product/',
    label: 'Custom Keys Co — Keycaps & Accessories',
    category: 'Keycaps',
    vendor: 'Custom Keys Co',
  },

  // ─── Sale collections (active-deals widget) ────────────────────────────────
  // Shopify sale collections — same stable products.json API, discounted items only

  'keeb-io-sale': {
    url: 'https://keeb.io/collections/sale/products.json?limit=50',
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
    baseUrl: 'https://keeb.io/products/',
    label: 'Keebio — Sale',
    category: 'Keyboards',
    vendor: 'Keebio',
  },

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

// ─── Phase 4: Vendor API handlers ─────────────────────────────────────────────

/**
 * Digikey Product Search API v4 — OAuth2 client credentials flow.
 * Requires context.apiKeys.digikey_client_id + digikey_client_secret.
 * OAuth2 tokens are cached in-process until 60 s before expiry.
 * opts: { keywords, limit? }
 */
async function scrapeDigikeyApi(opts, mode, context = {}) {
  const clientId     = context.apiKeys?.digikey_client_id;
  const clientSecret = context.apiKeys?.digikey_client_secret;
  if (!clientId || !clientSecret) {
    throw new Error('Digikey API keys not configured (digikey_client_id, digikey_client_secret)');
  }
  const keywords = opts.keywords;
  if (!keywords) throw new Error('digikey-api requires opts.keywords');
  const limit = opts.limit ?? 10;

  // Fetch (or reuse) OAuth2 bearer token — cached until 60 s before expiry
  const tokenCacheKey = crypto.createHash('sha256').update(clientId).digest('hex').slice(0, 16);
  let cachedTok = digikeyTokenCache.get(tokenCacheKey);
  if (!cachedTok || Date.now() >= cachedTok.expiresAt) {
    const tokenRes = await axios.post(
      'https://api.digikey.com/v1/oauth2/token',
      new URLSearchParams({
        grant_type:    'client_credentials',
        client_id:     clientId,
        client_secret: clientSecret,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15_000 }
    );
    const expiresIn = tokenRes.data.expires_in ?? 1800;
    cachedTok = {
      token:     tokenRes.data.access_token,
      expiresAt: Date.now() + (expiresIn - 60) * 1000,
    };
    digikeyTokenCache.set(tokenCacheKey, cachedTok);
  }

  const res = await axios.post(
    'https://api.digikey.com/products/v4/search/keyword',
    { Keywords: keywords, Limit: limit, Offset: 0 },
    {
      headers: {
        'Authorization':             `Bearer ${cachedTok.token}`,
        'X-DIGIKEY-Client-Id':       clientId,
        'X-DIGIKEY-Locale-Site':     'US',
        'X-DIGIKEY-Locale-Language': 'en',
        'Content-Type':              'application/json',
      },
      timeout: 15_000,
    }
  );

  const products = res.data?.Products ?? [];
  return products.map(p => ({
    name:         p.Description?.ProductDescription ?? p.ManufacturerProductNumber ?? '',
    partNumber:   p.ManufacturerProductNumber  ?? undefined,
    url:          p.ProductUrl                 ?? undefined,
    price:        p.UnitPrice != null          ? String(p.UnitPrice)          : undefined,
    availability: p.QuantityAvailable != null  ? String(p.QuantityAvailable)  : undefined,
    manufacturer: p.Manufacturer?.Name         ?? undefined,
  })).filter(i => i.name);
}

/**
 * Mouser Search API v2 — simple API key auth.
 * Requires context.apiKeys.mouser_api_key.
 * IMPORTANT: Mouser ToS §4 prohibits caching. This function MUST NOT be cached
 * at the source level in feedConfig.js — it always makes a live request.
 * opts: { keywords, limit? }
 */
async function scrapeMouserApi(opts, mode, context = {}) {
  const apiKey = context.apiKeys?.mouser_api_key;
  if (!apiKey) throw new Error('Mouser API key not configured (mouser_api_key)');
  const keywords = opts.keywords;
  if (!keywords) throw new Error('mouser-api requires opts.keywords');
  const records = opts.limit ?? 10;

  const res = await axios.post(
    `https://api.mouser.com/api/v2/search/keyword?apiKey=${encodeURIComponent(apiKey)}`,
    {
      SearchByKeywordRequest: {
        keyword:                     keywords,
        records,
        startingRecord:              0,
        searchOptions:               null,
        searchWithYourSignUpLanguage: null,
      },
    },
    {
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      timeout: 15_000,
    }
  );

  const products = res.data?.SearchResults?.Products ?? [];
  return products.map(p => ({
    name:         p.ManufacturerPartNumber ?? p.Description ?? '',
    partNumber:   p.ManufacturerPartNumber           ?? undefined,
    url:          p.ProductDetailUrl                 ?? undefined,
    price:        Array.isArray(p.PriceBreaks) && p.PriceBreaks.length > 0
                    ? p.PriceBreaks[0].Price
                    : undefined,
    availability: p.AvailabilityInStock != null ? String(p.AvailabilityInStock) : undefined,
    manufacturer: p.Manufacturer                     ?? undefined,
  })).filter(i => i.name);
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
  RULE_TYPE_HANDLERS,
  runSource, testRule, scratchBatch, scrapeBuiltinSource,
  scrapeHtml, scrapeJson, scrapeJsonMulti, scrapeRss,
  scrapeAmazonApi, scrapeNeweggJson,
  scrapeAdafruit, scrapeUserDigikey, scrapeUserMouser, updateCache,
  scrapeDigikeyApi, scrapeMouserApi,
  validateUserRssUrl,
};
