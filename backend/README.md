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

<<<<<<< Updated upstream
=======
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

>>>>>>> Stashed changes
| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | API listen port |
| `PGHOST` | `localhost` | Postgres host |
| `PGPORT` | `5432` | Postgres port |
| `PGDATABASE` | `shopdeck` | Database name |
| `PGUSER` | `shopdeck` | Postgres user |
| `POSTGRES_PASSWORD` | `shopdeck_dev` | Postgres password — used by both the API and the postgres container init |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `JWT_SECRET` | `shopdeck-dev-secret-change-in-prod` | JWT signing secret |
| `APP_BASE_URL` | `http://localhost:3000` | Frontend app URL used in verification emails |
| `SMTP_HOST` | _(empty)_ | SMTP host for sending verification emails |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | _(empty)_ | SMTP auth username |
| `SMTP_PASS` | _(empty)_ | SMTP auth password |
| `SMTP_SECURE` | `false` | Use TLS-only SMTP transport when true |
| `MAIL_FROM` | `ShopDeck <no-reply@shopdeck.local>` | Sender shown in verification emails |
| `CORS_ORIGIN` | _(empty)_ | Comma-separated browser origins allowed to call the API directly. Leave empty when using the Next.js proxy. |
| `NODE_ENV` | `production` | Set to `development` in dev mode |

Create a `backend/.env` file to override any of these locally (copy from `backend/.env.example`).

## Scraper item fields

The scraper adds computed stock fields to each Shopify-sourced item:

| Field | Values | Meaning |
|---|---|---|
| `anyAvailable` | `'true'` / `'false'` | At least one variant is purchasable |
| `partialStock` | `'true'` / `'false'` | Some but not all tracked variants are available |
| `lowStock` | `'true'` / `'false'` | All tracked variants are at or below the low-stock threshold |
| `totalInventory` | numeric string | Sum of all tracked variant quantities |

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

