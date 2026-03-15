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

## Auth System

- **JWT** payload includes: `id`, `username`, `email`, `is_demo`, `email_verified`, `has_password`
- **OAuth sign-in routes** (unauthenticated):
  - `POST /api/auth/github/device/signin` — GitHub Device Flow complete sign-in
  - `POST /api/auth/google` — Google ID-token sign-in (credential from `@react-oauth/google`)
- **OAuth account-link routes** (requires JWT):
  - `POST /api/auth/github/device/poll` — links GitHub to an existing session (used in Settings)
  - `POST /api/auth/google/link` / `DELETE /api/auth/google/link`
- **Email verification**:
  - Tokens stored in `email_tokens` table (type: `'verification'` or `'email_change'`)
  - `GET /api/auth/verify-email?token=` — verifies or applies email change
  - `POST /api/auth/resend-verification` — rate-limited to 5/hr per user
  - `POST /api/auth/change-email` — sends change-email token; re-verified before applying
  - Hard-block enforced via `REQUIRE_EMAIL_VERIFICATION=true` env var (default off)
  - Dashboard shows amber banner when `email_verified === false`; dismissable via `localStorage`
- **Set-password flow**: OAuth-only accounts have `has_password=false`; use `POST /api/auth/set-password` to add a password. Updates `has_password` to `true` and returns a fresh JWT.
- **Features endpoint** `GET /api/features` returns `{ plaid, github_oauth, google_oauth }` — controls which OAuth buttons are shown in Login and Settings
- **Username assignment**: removed from Register form; auto-generated as `user_<hex8>` on registration; user sets a real username in the first onboarding step (`StepUsername`)
- **Environment requirements**:
  - `GOOGLE_CLIENT_ID` — enables Google login (backend)
  - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — same value, frontend `<GoogleOAuthProvider>`
  - `SENDGRID_API_KEY` + `EMAIL_FROM` — enable real email sending (falls back to `console.log`)
  - `FRONTEND_URL` — used to construct verification links in emails
  - `REQUIRE_EMAIL_VERIFICATION` — `false` (default) or `true`

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
- **Mouser API — caching is contractually prohibited.** The Mouser API Terms of Service (Section 4) explicitly forbid caching, pre-fetching, or storing any Mouser data. The `mouser-api` rule type MUST bypass the Redis source cache and the in-process `localSourceCache` entirely. Every call to `runSource` for a Mouser rule must make a live API request. Do not add Mouser source IDs to the background warmer (`warmAllSources`).

## General Coding Conventions

- Keep components co-located in `src/components/`
- Pages live in `pages/` (Next.js pages router)
- Use `getToken()` for all authenticated API calls from the frontend
- Prefer real live data; mock/seed data is for tests only
- Do not add comments or docstrings to code that wasn't changed

## Auth And Verification Notes

- Password policy is mirrored in `backend/lib/passwordValidation.js` and `src/lib/passwordValidation.ts`. Keep them in sync.
- Email verification supports both a direct-link token flow and a manual code flow. Preserve both unless the task explicitly changes that product decision.
- `accountVerified` is intentionally exposed through auth payloads and `GET /api/auth/me`; frontend auth state should keep using that field.
- Resend verification currently supports both authenticated users and email-based resend from the verify page. Avoid reintroducing account-enumerating responses for unauthenticated resend requests.
- For local development, if SMTP is not configured, the backend logs the verification link and code. Do not remove that fallback unless a replacement local-development path is added.
- For production-oriented tasks touching verification, prefer documenting or implementing these follow-ups when relevant:
	- sender/provider configuration (`APP_BASE_URL`, `MAIL_FROM`, `SMTP_*`)
	- cleanup of expired verification tokens/codes
	- provider deliverability setup such as SPF/DKIM
	- monitoring of email send failures and resend/verify abuse
