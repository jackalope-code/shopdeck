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

- `css` — Cheerio multi-field CSS scraping (last resort)
- `jsonpath` — Single-field JSONPath extraction
- `jsonpath-multi` — Multi-field per container (preferred for Shopify `products.json`)

## General Coding Conventions

- Keep components co-located in `src/components/`
- Pages live in `pages/` (Next.js pages router)
- Use `getToken()` for all authenticated API calls from the frontend
- Prefer real live data; mock/seed data is for tests only
- Do not add comments or docstrings to code that wasn't changed
