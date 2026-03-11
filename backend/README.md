# Shopdeck Backend

Express.js API server with PostgreSQL, Redis, and a multi-source scraper.

## Quick start (Docker)

```bash
# From the backend/ directory:

# First run — wipe old volume so demo seed is applied
docker compose down -v
npm run docker:dev
```

This starts:
- **PostgreSQL 16** on the `backend` Docker network
- **Redis 7** on the `backend` Docker network
- **API server** on port 4000
- **Demo account** seeded automatically

### Demo account credentials

| Field | Value |
|---|---|
| Username | `demo` |
| Password | `demo1234` |
| Email | `demo@shopdeck.local` |

### npm scripts

| Command | Description |
|---|---|
| `npm run docker:dev` | Start all services in development mode with demo seed |
| `npm run dev` | Start the API server directly (requires local Postgres + Redis) |
| `npm start` | Same as `dev` |

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | API listen port |
| `PGHOST` | `localhost` | Postgres host |
| `PGPORT` | `5432` | Postgres port |
| `PGDATABASE` | `shopdeck` | Database name |
| `PGUSER` | `shopdeck` | Postgres user |
| `PGPASSWORD` | `shopdeck_dev` | Postgres password |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `JWT_SECRET` | `shopdeck-dev-secret-change-in-prod` | JWT signing secret |
| `NODE_ENV` | `production` | Set to `development` in dev mode |

Create a `backend/.env` file to override any of these locally.

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
| GET | `/api/profile` | Yes | Get user profile |
| PATCH | `/api/profile` | Yes | Update profile settings |
| GET | `/api/feed-config` | Yes | Get widget feed config |
| PATCH | `/api/feed-config/:widgetId` | Yes | Update widget sources |
| GET | `/api/feed-config/data/:widgetId` | Yes | Fetch scraped feed data |
| GET | `/api/projects` | Yes | List projects |
| POST | `/api/projects` | Yes | Create project |
| GET | `/api/activity` | Yes | Recent activity log |
| GET | `/api/ai-history` | Yes | AI chat history |

