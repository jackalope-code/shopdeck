# Shopdeck – GitHub Copilot Instructions

## Data Sources

**Prefer official APIs, RSS/Atom feeds, and structured data endpoints over HTML scraping.**

Priority order when fetching product/pricing data:
1. **Official REST/GraphQL APIs** (e.g. Shopify `products.json`, vendor APIs, retailer APIs)
2. **RSS / Atom feeds** (e.g. vendor new-product feeds, deal feeds like SlickDeals RSS)
3. **JSON endpoints** (e.g. `.json` routes, `api/` paths exposed publicly)
4. **Structured markup** (e.g. JSON-LD, Open Graph tags, schema.org `<script type="application/ld+json">`)
5. **CSS/HTML scraping** — last resort only, when no structured data is available

Scraping fragile HTML is a maintenance burden. Always check for a Shopify `products.json`, an `/api/` route, or an RSS feed before writing a CSS selector scraper.

## Stack

- **Frontend**: Next.js (React 19, TypeScript, Tailwind v4), port 3000
- **Backend**: Express.js, port 4000; proxied via `/api/*` in `next.config.js`
- **Auth**: `getToken()` from `src/lib/auth.ts`, sent as `Authorization: Bearer <token>`
- **Feed data API**: `GET /api/feed-config/data/:widgetId` — auth-protected, 6 hr in-memory cache

## Scraper Rule Types (`backend/scraper.js`)

All rule types are registered in the `RULE_TYPE_HANDLERS` map and routed through `runSource()`. Rules may also carry a `postFilter: { requireAny, excludeAny }` for name-based post-processing.

- `css` — Cheerio multi-field CSS scraping (last resort)
- `jsonpath` — Single-field JSONPath extraction
- `jsonpath-multi` — Multi-field per container (preferred for Shopify `products.json`)
- `rss` — RSS/Atom feed via fast-xml-parser
- `amazon-api` — Amazon Product Advertising API v5 (requires keys in user `api_keys`)
- `newegg-search-api` — Newegg public JSON search API (no key required)
- `user-rss` — User-supplied RSS URL; SSRF-validated before fetch (Phase 3)
- `digikey-api` — Digikey Product Search API v4; OAuth2 client credentials (Phase 4)
- `mouser-api` — Mouser Search API v2; simple API key auth (Phase 4)
- `webhook-buffer` — Reads a Redis ring buffer populated by inbound webhook POSTs (Phase 5)
- `manual-list` — Reads user-curated items from `manual_list_items` Postgres table (Phase 6)

## Caching

- Do **not** add query-parameter flags (e.g. `?refresh=1`, `?bust=true`) or any other mechanism that lets callers bypass or invalidate the cache from outside the server.
- Cache TTL and invalidation are server-side concerns only. If stale data is a problem, fix the scraper or adjust the TTL — never expose a cache-bust escape hatch through the API.

### Feed cache policy (non-API sources)

All non-API feed sources (css, jsonpath, jsonpath-multi, rss, user-rss, manual-list, webhook-buffer) **must always be served from cache**. Never re-scrape them on every request.

| Source type | Hard TTL | SWR refresh threshold |
|---|---|---|
| `rss`, `user-rss` | 6 h | 6 h (i.e. always refreshed when cache expires) |
| All other non-API | 24 h | 6 h |

**Stale-while-revalidate (SWR):** When a cached entry is older than 6 h, the current request is served immediately from the stale cache. A background refresh is triggered concurrently via `triggerBackgroundRefresh()` — the next request then receives fresh data. Only one background refresh per source runs at a time (coalesced via `inFlightScrapes`).

**Widget response cache:** Widget-level assembled responses are cached for 24 h (no API sources) or bypassed entirely (any API source present). When the assembled response is older than 6 h it is served stale and the cache entry is invalidated so the next request re-assembles from the (already SWR-refreshed) source caches.

**Warmer (`warmAllSources`):** Runs every 6 h via cron. Skips sources whose cache is still within TTL. RSS sources are re-warmed every run (6 h TTL). Non-API scraper sources are only re-warmed after their 24 h TTL expires. API-type sources are always skipped.

- **Mouser API — caching is contractually prohibited.** The Mouser API Terms of Service (Section 4) explicitly forbid caching, pre-fetching, or storing any Mouser data. The `mouser-api` rule type MUST bypass the Redis source cache and the in-process `localSourceCache` entirely. Every call to `runSource` for a Mouser rule must make a live API request. Do not add Mouser source IDs to the background warmer (`warmAllSources`).
- All other API-type sources (`amazon-api`, `newegg-search-api`, `digikey-api`, and any rule type ending in `-api`) are also never cached and never pre-warmed.

## General Coding Conventions

- Keep components co-located in `src/components/`
- Pages live in `pages/` (Next.js pages router)
- Use `getToken()` for all authenticated API calls from the frontend
- Prefer real live data; mock/seed data is for tests only
- Do not add comments or docstrings to code that wasn't changed

## Testing & Regression Policy

All widget, page, and feed-data changes must be validated with tests before and after implementation to limit regressions.

### Required workflow for widget/page/feed changes

1. Run a relevant baseline test pass before edits (to confirm starting state).
2. Make the code changes.
3. Re-run the same relevant suites plus impacted smoke checks.
4. Do not finalize changes with failing tests unless the failure is unrelated and explicitly documented.

### Smoke-first UI testing

- UI smoke tests are the starting point for frontend regression checks.
- Smoke coverage must include at least:
	- app boot and auth route render
	- dashboard route render and primary controls
	- representative key routes (for example deals and drops)

### Command matrix by change type

- **Widget changes** (`src/components/`):
	- `npm run test`
	- `npm run test:smoke`
	- `npm run typecheck`

- **Page changes** (`pages/`):
	- `npm run test`
	- `npm run test:smoke`
	- `npm run typecheck`

- **Feed/backend changes** (`backend/routes/feedConfig.js`, `backend/scraper.js`, feed sources/rules):
	- `npm run test:feed`
	- optional live probe: `SHOPDECK_BACKEND_URL=http://127.0.0.1:4000 npm run test:feed`

- **Cross-cutting changes** (widgets/pages + feed logic):
	- `npm run test:regression`
	- `npm run test:smoke`
	- `npm run test:feed`

### Feed testing constraints

- Keep CI feed tests deterministic with fixtures/mocks where practical.
- Live upstream probe tests are allowed, but should be optional/manual to avoid flaky CI failures.
- Maintain Mouser no-cache behavior while testing (`mouser-api` requests must stay live and uncached).
