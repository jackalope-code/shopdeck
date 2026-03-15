# Shopdeck Backend

Express.js API server with PostgreSQL, Redis, and a multi-source scraper.

## Quick start

### Full stack (from project root)

```bash
# From the repo root — starts frontend + API + Postgres + Redis
npm run docker
```

The `ui` container serves the Next.js frontend on port 80 and proxies `/api/*` to the `api` container internally.

### Backend services only (for local frontend dev)

```bash
# From backend/ — starts Postgres + Redis only
npm run docker:services:dev

# Then start the API directly
npm run dev
```

### Demo account

Demo sessions are created on demand via `POST /api/auth/demo` — no seed file required. Use the **Try Demo** button on the login page.

### npm scripts

| Command | Description |
|---|---|
| `npm run docker:dev` | Start API + Postgres + Redis in development mode |
| `npm run docker:services:dev` | Start Postgres + Redis only (use with local `npm run dev`) |
| `npm run dev` | Start the API server with nodemon (requires local Postgres + Redis) |
| `npm start` | Start the API server (production) |

## Environment variables

Copy `backend/.env.example` to `backend/.env` and fill in the values relevant to your deployment. All variables have defaults suitable for local development with Docker Compose.

### Core server

| Variable | Default | Required | Description |
|---|---|---|---|
| `PORT` | `4000` | No | API listen port |
| `NODE_ENV` | `development` | No | Set to `production` in production |
| `CORS_ORIGIN` | _(empty)_ | No | Comma-separated browser origins allowed to call the API directly. Leave empty when the API is only accessed through the Next.js proxy (recommended). |

### PostgreSQL

| Variable | Default | Required | Description |
|---|---|---|---|
| `PGHOST` | `localhost` | No | Postgres host |
| `PGPORT` | `5432` | No | Postgres port |
| `PGDATABASE` | `shopdeck` | No | Database name |
| `PGUSER` | `shopdeck` | No | Postgres user |
| `POSTGRES_PASSWORD` | `shopdeck_dev` | **Yes (prod)** | Postgres password. Used by both the API pool and the postgres container init. |

### Redis

| Variable | Default | Required | Description |
|---|---|---|---|
| `REDIS_HOST` | `localhost` | No | Redis host |
| `REDIS_PORT` | `6379` | No | Redis port |

### Auth & security

| Variable | Default | Required | Description |
|---|---|---|---|
| `JWT_SECRET` | `shopdeck-dev-secret-change-in-prod` | **Yes (prod)** | JWT signing secret. Use a long random string in production. |
| `TOKEN_ENCRYPTION_KEY` | _(none)_ | **Yes** | 64-character hex string used to AES-256-GCM encrypt stored tokens and API keys. Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` — must be stable; changing it invalidates all stored tokens. |

### GitHub OAuth (optional)

Leave both unset to disable GitHub login.

| Variable | Description |
|---|---|
| `GITHUB_OAUTH_CLIENT_ID` | OAuth App client ID from github.com/settings/developers |
| `GITHUB_OAUTH_CLIENT_SECRET` | OAuth App client secret |

### AI assistant (optional)

| Variable | Default | Description |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Base URL of a running Ollama instance. Only used when a user selects the Ollama provider in AI Assistant settings. |

---

### Vendor API keys

Shopdeck supports two tiers of vendor API keys:

- **Per-user keys** — stored encrypted in the database under each user's profile (`api_keys` column). Users enter these during onboarding (Seller / Content Creator paths) or in **Settings → API Keys**. The server never exposes them in plaintext.
- **Server-level fallback keys** — set as environment variables on the server. These apply to all users who have not configured their own per-user key. Useful for single-operator deployments where you want one shared key for every user.

Amazon PA API keys are **per-user only** — there is no server-level fallback because Amazon Associates accounts are tied to individual affiliates.

#### Amazon Product Advertising API — per-user only

Users configure these during onboarding (Seller / Content Creator path) or in **Settings → API Keys**. No server env var path exists.

| User-side field | Description |
|---|---|
| `amazon_access_key` | PA API v5 Access Key ID |
| `amazon_secret_key` | PA API v5 Secret Access Key |
| `amazon_partner_tag` | Associates tracking tag (e.g. `mystore-20`) |

Requires an active Amazon Associates account with ≥ 3 qualifying sales in the past 180 days. Apply at [affiliate-program.amazon.com](https://affiliate-program.amazon.com/).

#### CJ Affiliate API — per-user key, server fallback

Powers Home Depot, Lowe's, Dick Blick, Wayfair, Zappos, JOANN, Burpee Seeds, RockAuto, and other CJ merchant feeds.

| Env var | User-side field | Where to get it |
|---|---|---|
| `CJ_API_KEY` | `cj_api_key` | CJ personal access token — [developers.cj.com](https://developers.cj.com/) |

#### Mouser Search API — per-user key, server fallback

> **Note:** Mouser ToS § 4 prohibits caching. Responses are **never** cached regardless of key source — every Mouser request is live.

| Env var | User-side field | Where to get it |
|---|---|---|
| `MOUSER_API_KEY` | `mouser_api_key` | [mouser.com/api-search](https://www.mouser.com/api-search/) |

#### DigiKey Product Search API — per-user key, server fallback

| Env var | User-side field | Where to get it |
|---|---|---|
| `DIGIKEY_CLIENT_ID` | `digikey_client_id` | OAuth2 client ID — [developer.digikey.com](https://developer.digikey.com/) |
| `DIGIKEY_CLIENT_SECRET` | `digikey_client_secret` | OAuth2 client secret (same app) |

#### Walmart Affiliate API (Impact Radius) — per-user key, server fallback

| Env var | User-side field | Where to get it |
|---|---|---|
| `WALMART_IMPACT_API_KEY` | `walmart_impact_api_key` | Impact Radius key from the Walmart affiliate program |

#### Kroger Product API — server only

Powers Grocery feed widgets. Kroger credentials are issued per developer application, not per end user.

| Env var | Description |
|---|---|
| `KROGER_CLIENT_ID` | OAuth2 client ID — register a **public** application at [developer.kroger.com](https://developer.kroger.com/) |
| `KROGER_CLIENT_SECRET` | OAuth2 client secret (same app) |

The grocery feeds only need the `product.compact` scope — no user authentication is required.

#### IsThereAnyDeal API — server only

Powers the Games / Video Game Deals widget. A free tier works without a key; the key raises rate limits.

| Env var | Description |
|---|---|
| `ITAD_API_KEY` | API key from [isthereanydeal.com/dev/app](https://isthereanydeal.com/dev/app/) |

---

#### Plaid — optional bank account linking

When all three vars are set, the `GET /api/features` endpoint returns `{ plaid: true }`. This unlocks:
- A "Link a bank account" step at the end of onboarding (skipped for demo users)
- A **Linked Accounts** section in Settings → Accounts (hidden for demo users)
- The **Account Balances** widget in the dashboard widget picker

A 12-hour background cron syncs transactions for all linked users automatically.

In `NODE_ENV=development`, `PLAID_ENV` defaults to `sandbox` if unset, so local dev works without an extra env var.

| Env var | Description |
|---|---|
| `PLAID_CLIENT_ID` | Client ID from [dashboard.plaid.com](https://dashboard.plaid.com/) |
| `PLAID_SECRET` | Sandbox/development/production secret from the Plaid dashboard |
| `PLAID_ENV` | `sandbox`, `development`, or `production` |

> **Access tokens** are encrypted at rest using the same AES-256-GCM scheme as other stored credentials (`TOKEN_ENCRYPTION_KEY` in `.env`).

---

## Scraper item fields

The scraper adds computed stock fields to each Shopify-sourced item:

| Field | Values | Meaning |
|---|---|---|
| `anyAvailable` | `'true'` / `'false'` | At least one variant is purchasable |
| `partialStock` | `'true'` / `'false'` | Some but not all tracked variants are available |
| `lowStock` | `'true'` / `'false'` | All tracked variants are at or below the low-stock threshold |
| `totalInventory` | numeric string | Sum of all tracked variant quantities |

## Known limitations

- **Mouser image quality can still be low in card-heavy UIs.**
	- The Mouser Search API often returns thumbnail-grade product images for some queries.
	- Shopdeck applies best-effort Mouser image selection and URL upscaling, but if the source asset itself is low-resolution, cards may still look grainy.
	- This is a source-data limitation, not a cache issue (Mouser requests are live and bypass source/widget cache paths).

## Files

- `server.js` — Express app entry point
- `scraper.js` — Built-in source rules and scraping logic
- `schema.sql` — PostgreSQL table definitions
- `seed-demo.sql` — Demo account seed (auto-applied by Docker on first init)
- `docker-compose.yml` — Production-style compose (Postgres + Redis + API)
- `docker-compose.dev.yml` — Dev overrides (seeds demo account, sets NODE_ENV=development)
- `routes/` — Express route handlers (auth, profile, feedConfig, projects, ai, etc.)
- `middleware/auth.js` — JWT verification middleware

## API routes

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Create account |
| POST | `/api/auth/login` | No | Get JWT token |
| POST | `/api/auth/demo` | No | Create a temporary demo session |
| GET | `/api/health` | No | Health check (used by Docker healthcheck) |
| GET | `/api/profile` | Yes | Get user profile |
| PATCH | `/api/profile` | Yes | Update profile settings |
| GET | `/api/feed-config` | Yes | Get widget feed config |
| PATCH | `/api/feed-config/:widgetId` | Yes | Update widget sources |
| GET | `/api/feed-config/data/:widgetId` | Yes | Fetch scraped feed data |
| GET | `/api/projects` | Yes | List projects |
| POST | `/api/projects` | Yes | Create project |
| GET | `/api/activity` | Yes | Recent activity log |
| GET | `/api/ai-history` | Yes | AI chat history |

