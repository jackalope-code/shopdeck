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

### Google OAuth (optional)

Sign-in and account-linking with Google ID tokens. Leave unset to disable Google login.

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Client ID from [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials). Authorised JavaScript origins must include `FRONTEND_URL`. |

Also set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to the same value in the frontend environment (root `.env` or deployment env vars).

### Email verification (optional)

| Variable | Default | Description |
|---|---|---|
| `SENDGRID_API_KEY` | _(none)_ | SendGrid API key. When unset, verification email content is printed to the console instead of sent. |
| `EMAIL_FROM` | `noreply@shopdeck.app` | The "From" address used for all transactional emails. Must be a verified sender in your SendGrid account. |
| `FRONTEND_URL` | `http://localhost:3000` | Public URL of the Next.js frontend. Used to construct the verification link in emails. |
| `REQUIRE_EMAIL_VERIFICATION` | `false` | Set to `true` to hard-block login until the user verifies their email address. Default is soft-block: an amber banner is shown on the dashboard but login is allowed. |

### AI assistant (optional)


| Variable | Default | Description |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Base URL of a running Ollama instance. Only used when a user selects the Ollama provider in AI Assistant settings. |

---

### Vendor API keys

Shopdeck supports two tiers of vendor API keys:

- **Per-user keys** — stored encrypted in the database under each user's profile (`api_keys` column). Users enter these during onboarding (Seller / Content Creator paths) or in **Settings → API Keys**. Keys are AES-256-GCM encrypted at rest and returned in plaintext to the authenticated owner via `GET /api/profile`. The **UI masks all configured fields by default** — each field has a per-field eye icon that triggers an inline warning before revealing that value. Revealed values exist only in React state and are never written to `localStorage`, `sessionStorage`, or cookies.
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

> **Minimum permissions:** Create a dedicated IAM user and attach only the `AmazonAdvertisingAPI` managed policy. Do not attach S3, EC2, or any other AWS policies. Never use root account credentials.

#### CJ Affiliate API — per-user key, server fallback

Powers Home Depot, Lowe's, Dick Blick, Wayfair, Zappos, JOANN, Burpee Seeds, RockAuto, and other CJ merchant feeds.

| Env var | User-side field | Where to get it |
|---|---|---|
| `CJ_API_KEY` | `cj_api_key` | CJ personal access token — [developers.cj.com](https://developers.cj.com/) |

> **Minimum permissions:** A CJ personal access token grants read-only product feed access. Do not use your CJ account password or a token with publishing permissions.

#### Mouser Search API — per-user key, server fallback

> **Note:** Mouser ToS § 4 prohibits caching. Responses are **never** cached regardless of key source — every Mouser request is live.

| Env var | User-side field | Where to get it |
|---|---|---|
| `MOUSER_API_KEY` | `mouser_api_key` | [mouser.com/api-search](https://www.mouser.com/api-search/) |

> **Minimum permissions:** Mouser API keys grant read-only product search access by design — no write or ordering operations are available through this API.

#### DigiKey Product Search API — per-user key, server fallback

| Env var | User-side field | Where to get it |
|---|---|---|
| `DIGIKEY_CLIENT_ID` | `digikey_client_id` | OAuth2 client ID — [developer.digikey.com](https://developer.digikey.com/) |
| `DIGIKEY_CLIENT_SECRET` | `digikey_client_secret` | OAuth2 client secret (same app) |

> **Minimum permissions:** In the DigiKey Developer Portal, request access to the **Product Information** API product only. Do not request Order Management, Barcode, or other DigiKey API products.

#### Walmart Affiliate API (Impact Radius) — per-user key, server fallback

| Env var | User-side field | Where to get it |
|---|---|---|
| `WALMART_IMPACT_API_KEY` | `walmart_impact_api_key` | Impact Radius key from the Walmart affiliate program |

> **Minimum permissions:** Impact Radius publisher key — grants read-only product catalogue and affiliate tracking access.

#### Kroger Product API — server only

Powers Grocery feed widgets. Kroger credentials are issued per developer application, not per end user.

| Env var | Description |
|---|---|
| `KROGER_CLIENT_ID` | OAuth2 client ID — register a **public** application at [developer.kroger.com](https://developer.kroger.com/) |
| `KROGER_CLIENT_SECRET` | OAuth2 client secret (same app) |

The grocery feeds only need the `product.compact` scope — no user authentication is required. Do not request `cart.basic:write`, `profile.compact`, or `loyalty.compact` when registering the application.

#### IsThereAnyDeal API — server only

Powers the Games / Video Game Deals widget. A free tier works without a key; the key raises rate limits.

| Env var | Description |
|---|---|
| `ITAD_API_KEY` | API key from [isthereanydeal.com/dev/app](https://isthereanydeal.com/dev/app/) |

> **Minimum permissions:** ITAD API keys are read-only by API design — no write or account-mutation scope exists.

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

## Security

### Encryption at rest

All sensitive credentials stored in PostgreSQL are encrypted with **AES-256-GCM** before writing and decrypted on read. Each value gets its own random 96-bit IV, producing independent ciphertexts. Storage format: `iv_hex:authTag_hex:ciphertext_hex` (plain `TEXT` column). Helper module: `backend/lib/tokenCrypto.js` — functions `encryptToken` / `decryptToken` / `encryptMap` / `decryptMap` / `rotateEncryptedValues`.

Encrypted fields:

| Column | Table |
|---|---|
| `api_keys` (JSONB map) | `user_profiles` |
| `ai_config.apiKey` | `user_profiles` |
| `github_token` | `users` |
| `access_token_enc` | `plaid_items` |

### Threat model

| Threat | Protected? | Notes |
|---|:-:|---|
| DB dump / backup theft — attacker has data files, not env vars | ✅ | `TOKEN_ENCRYPTION_KEY` is not stored in the database |
| SQL injection or read-replica access to the `api_keys` column | ✅ | Only ciphertext is stored; useless without the key |
| DB admin without access to the application server | ✅ | Same reason |
| Server process compromise — env vars readable | ❌ | Inherent to the server-side API proxy model; cannot be eliminated without abandoning proxying |
| Simultaneous DB + `TOKEN_ENCRYPTION_KEY` capture | ❌ | Mitigated by storing them in separate systems (see below) |
| Operator with full server access | ❌ | Mitigated by scoped keys (user-side) and the audit log |

### Recommended operator practices

- **Isolate secrets**: store `TOKEN_ENCRYPTION_KEY` in a dedicated secrets manager (Doppler, AWS Secrets Manager, HashiCorp Vault, etc.) **separate from database credentials**. A DB compromise alone is then insufficient to decrypt stored keys.
- **Never commit**: `TOKEN_ENCRYPTION_KEY` must not appear in source control, application logs, or error messages.
- **Rotate on suspicion**: if `TOKEN_ENCRYPTION_KEY` is suspected compromised, run the rotation script (see below) and update the secret before restarting the application server.
- **Advise scoped keys**: guide users to configure the narrowest possible permissions for each vendor key (see per-provider guidance in the Vendor API keys section above). A minimally-scoped key has limited blast radius even if decrypted.

### API key access audit log

Every time the scraper uses a user's vendor API key, an entry is written to `api_key_access_log`:

| Column | Description |
|---|---|
| `user_id` | The user whose key was used |
| `key_names` | Array of field slot names accessed (e.g. `['amazonAccessKey','amazonSecretKey']`) — **never key values** |
| `provider` | Rule type: `amazon-api`, `digikey-api`, `mouser-api`, etc. |
| `accessed_at` | Timestamp |

Inserts are fire-and-forget — failures are logged to console but never block the scrape request. Rows older than 90 days are deleted weekly by the server cron.

### Key rotation

If `TOKEN_ENCRYPTION_KEY` is compromised, re-encrypt all stored credentials in place:

```bash
OLD_TOKEN_ENCRYPTION_KEY=<current 64-hex> \
NEW_TOKEN_ENCRYPTION_KEY=<new 64-hex> \
node backend/rotate-encryption-key.js
```

The script re-encrypts all `api_keys`, `ai_config.apiKey`, `github_token`, and Plaid access tokens in a single DB transaction and prints a row-count summary. After a successful run, update `TOKEN_ENCRYPTION_KEY` to the new value in your secrets manager and restart the application server.

**The script is intentionally not exposed as an HTTP route.** To invoke it you need direct server access.

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
| GET | `/api/auth/verify-email` | No | Verify via one-click email link token |
| POST | `/api/auth/verify-email-code` | Optional | Verify via one-time code (auth user or email+code) |
| POST | `/api/auth/resend-verification` | Yes | Resend fresh verification link and code |
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

## Natural Next Steps

The email-verification implementation is in place. The remaining work is mostly deployment and operational follow-through:

1. Configure delivery
	- Set `APP_BASE_URL`, `MAIL_FROM`, and the `SMTP_*` variables.
	- If `SMTP_*` is unset, the backend logs the verification link and code instead of sending mail. That is acceptable for local development, not production.

2. Validate the flow
	- Register a new account.
	- Confirm `accountVerified` is `false` on login/me until verification.
	- Verify once with the email link and once with the code path on separate accounts.
	- Confirm resend invalidates prior credentials and enforces cooldowns.

3. Production provider recommendation
	- Use SendGrid SMTP first for the lowest-friction production setup.
	- Typical config:

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=YOUR_SENDGRID_API_KEY
SMTP_SECURE=false
MAIL_FROM=ShopDeck <noreply@yourdomain.com>
APP_BASE_URL=https://your-frontend-domain
```

4. Production hardening
	- Authenticate your sender/domain with SPF and DKIM.
	- Add periodic cleanup for expired rows in `email_verification_tokens` and `email_verification_codes`.
	- Monitor logs for `Verification email send failed` and resend/verify abuse patterns.

5. Recommended follow-up features
	- add change-email + re-verify flow
	- add resend cooldown countdown anywhere verification is shown
	- add bounce/complaint visibility if using a provider with event webhooks

