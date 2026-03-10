'use strict';
/**
 * backend/mcp/tools.js
 * Data-fetch functions for the MCP integration.
 * Each function respects the user's permission flags and returns null when
 * the relevant permission is not granted.
 */

const fs      = require('fs');
const path    = require('path');
const scraper = require('../scraper');

const USERS_FILE         = path.join(__dirname, '../users.json');
const WATCHLISTS_FILE    = path.join(__dirname, '../userWatchlists.json');
const FEED_DEFAULTS_FILE = path.join(__dirname, '../userFeedConfig.json');

function readUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch { return []; }
}
function readWatchlists() {
  try { return JSON.parse(fs.readFileSync(WATCHLISTS_FILE, 'utf8')); } catch { return {}; }
}
function readFeedDefaults() {
  try { return JSON.parse(fs.readFileSync(FEED_DEFAULTS_FILE, 'utf8')).defaults ?? {}; } catch { return {}; }
}

// ─── Per-user in-memory rate cap for live deals scraping ──────────────────────
// 5 calls per user per hour; resets on server restart (single-process dev server).
const DEALS_MAX_PER_HOUR = 5;
const DEALS_WINDOW_MS    = 60 * 60 * 1000;
/** @type {Map<string, number[]>} userId → call timestamps */
const dealsCallLog = new Map();

function enforceDealsRateLimit(userId) {
  const now = Date.now();
  const log = (dealsCallLog.get(userId) ?? []).filter(t => (now - t) < DEALS_WINDOW_MS);
  if (log.length >= DEALS_MAX_PER_HOUR) {
    const retryAfterSec = Math.ceil((Math.min(...log) + DEALS_WINDOW_MS - now) / 1000);
    throw new Error(
      `Deals scrape rate limit reached (${DEALS_MAX_PER_HOUR}/hr). Retry in ${retryAfterSec}s.`
    );
  }
  log.push(now);
  dealsCallLog.set(userId, log);
}

// ─── Tool: get_projects ───────────────────────────────────────────────────────
/**
 * Returns the user's build projects (budget, status, component count, etc.)
 * @param {string}  userId
 * @param {object}  permissions  { projects, inventory, watchlist, deals }
 * @returns {object[]|null}  null when permission not granted
 */
async function getProjects(userId, permissions) {
  if (!permissions?.projects) return null;
  const user = readUsers().find(u => u.id === userId);
  if (!user) return null;
  return (user.profile?.projects ?? []).map(p => ({
    id:             p.id,
    name:           p.name,
    status:         p.status,
    forSale:        p.forSale,
    budget:         p.budget       ?? null,
    spent:          p.spent        ?? 0,
    targetPrice:    p.targetPrice  ?? null,
    estProfit:      p.estProfit    ?? null,
    sourced:        p.sourced      ?? 0,
    total:          p.total        ?? 0,
    modified:       p.modified,
    componentCount: (p.components ?? []).length,
  }));
}

// ─── Tool: get_inventory ──────────────────────────────────────────────────────
/**
 * Returns a flat list of all components across all of the user's projects.
 * Note: the MyElectronics page uses hardcoded static data that is not yet
 * persisted server-side — those parts are excluded from this scope.
 * @param {string}  userId
 * @param {object}  permissions
 * @returns {object[]|null}
 */
async function getInventory(userId, permissions) {
  if (!permissions?.inventory) return null;
  const user = readUsers().find(u => u.id === userId);
  if (!user) return null;
  const components = [];
  for (const project of (user.profile?.projects ?? [])) {
    for (const comp of (project.components ?? [])) {
      components.push({ ...comp, _projectName: project.name, _projectId: project.id });
    }
  }
  return components;
}

// ─── Tool: get_watchlist ──────────────────────────────────────────────────────
/**
 * Returns the user's DigiKey and Mouser watchlist items.
 * @param {string}  userId
 * @param {object}  permissions
 * @returns {{ digikey: object[], mouser: object[] }|null}
 */
async function getWatchlist(userId, permissions) {
  if (!permissions?.watchlist) return null;
  const watchlists = readWatchlists();
  return watchlists[userId] ?? { digikey: [], mouser: [] };
}

// ─── Tool: get_active_deals ───────────────────────────────────────────────────
/**
 * Triggers a fresh scrape of the user's active-deals sources (custom rules only;
 * built-in source names are returned as metadata stubs since they have no
 * live scraping rules configured).  Uses scraper 'test' mode which enforces a
 * 1-minute per-host cooldown.  Also enforces a 5 calls/hr per-user cap.
 *
 * @param {string}       userId
 * @param {object}       permissions
 * @param {object|null}  feedConfig  Pre-merged user feed config, or null to
 *                                   auto-resolve from user profile + defaults.
 * @returns {object|null}
 */
async function getActiveDeals(userId, permissions, feedConfig) {
  if (!permissions?.deals) return null;

  enforceDealsRateLimit(userId);

  // Resolve feed config
  let dealsConfig;
  if (feedConfig?.['active-deals']) {
    dealsConfig = feedConfig['active-deals'];
  } else {
    const user  = readUsers().find(u => u.id === userId);
    const userOverride = user?.profile?.feedConfig?.['active-deals'];
    dealsConfig = userOverride ?? readFeedDefaults()['active-deals'] ?? {};
  }

  const enabledSources = (dealsConfig.sources ?? []).filter(s => s.enabled);
  const customRules    = dealsConfig.custom ?? [];

  const customResults = [];
  for (const rule of customRules) {
    try {
      // 'test' mode enforces the 1-min per-host cooldown inside scraper.js
      const data = await scraper.runSource(rule, 'test');
      customResults.push({ source: rule.fieldName ?? rule.url, data, error: null });
    } catch (err) {
      customResults.push({ source: rule.fieldName ?? rule.url, data: [], error: err.message });
    }
  }

  return {
    scrapedAt: new Date().toISOString(),
    customResults,
    // Built-in named sources have no live scrape rules yet — surface names only
    builtinSources: enabledSources.map(s => ({ id: s.id, name: s.name })),
  };
}

module.exports = { getProjects, getInventory, getWatchlist, getActiveDeals };
