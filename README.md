# ShopDeck

[![Tests](https://github.com/jackalope-code/shopdeck/actions/workflows/test-pipeline.yml/badge.svg)](https://github.com/jackalope-code/shopdeck/actions/workflows/test-pipeline.yml)

A keyboard/electronics deal tracker and project manager built with Next.js, Express, PostgreSQL, and Redis.

<img width="3822" height="1795" alt="Screenshot 2026-03-09 180716" src="https://github.com/user-attachments/assets/35489334-648e-4e08-a8dc-6bf93b806799" />

## Stack

- **Frontend**: Next.js (React 19, TypeScript, Tailwind v4) — port 3000
- **Backend**: Express.js — port 4000
- **Database**: PostgreSQL 16
- **Cache**: Redis 7

## Branch protection (`main`)

Enable branch protection on `main` so merges require the test pipeline to pass:

1. Go to **GitHub → Settings → Branches → Add branch protection rule**.
2. Set **Branch name pattern** to `main`.
3. Enable **Require a pull request before merging**.
4. Enable **Require status checks to pass before merging** and select these checks:
	- `Lint Typecheck Unit`
	- `Feed Tests`
	- `Smoke Tests`
5. Save the rule.

These checks are produced by `.github/workflows/test-pipeline.yml`.

---

## Development mode
* git clone the project
* In one terminal:
* cd backend
* npm run docker:services:dev
* In a second terminal:
* cd backend
* npm run dev
* In a third terminal:
* npm run dev from project root

# Known issues
* Some sales sources are still unreliable (vendor-side 404s, missing API keys, or strict anti-scrape cooldown on HTML-only endpoints)

## Current status (March 2026)

Completed recently:
- Variant stock inference is implemented for Shopify JSON feeds, including OOS/in-stock text-signal fallback.
- Per-variant payload data (`_variants`) is emitted by the scraper and consumed by the frontend feed types.
- Keyboard comparison now treats `partialStock` as limited availability (not fully in stock).
- Variant breakdown UI is live in both keycaps cards and keyboard comparison specs.
- Keycaps tracker data flow is restored (live `keycap-releases` endpoint returning source data).
- Aggregated deals categorization now derives from product metadata first, so electronics items can classify as `Components` / `Audio` instead of always collapsing to `Electronics`.

## Useful next steps

1. Stabilize non-Mouser deal diversity:
	- Fix broken Adafruit category source URLs returning 404.
	- Decide whether HTML sources (like Adafruit sales) should keep long cooldown or use a shorter policy for sale pages.
2. Improve electronics sale coverage:
	- Configure Digikey API keys in `backend/.env` (if desired for deal aggregation breadth).
3. Keep validation repeatable:
	- After backend restarts, verify:
	  - `GET /api/feed-config/data/keycap-releases`
	  - `GET /api/feed-config/data-aggregated/deals`
	- Confirm category mix and source error summaries before shipping.

# Planned features
* Feed viewing/editing
* More categories

## Production / Full-stack Docker (recommended)

Runs the full stack — frontend (port 80), backend API, PostgreSQL, and Redis — all in containers.

```bash
git clone https://github.com/jackalope-code/shopdeck.git
cd shopdeck

# Create backend/.env (copy from backend/.env.example and fill in secrets)
cp backend/.env.example backend/.env

# Optional: create .env.local to override for local dev (e.g. POSTGRES_PASSWORD)
# cp .env.example .env.local

# First run — builds images, initialises DB
npm run docker
```

Open **http://localhost**.

> Use `docker compose down -v` to wipe volumes and reinitialise the database from `schema.sql`.

### Demo account

Use the **Try Demo** button on the login page — no credentials needed. The backend creates a temporary demo session automatically.

---

## Development Setup (split — frontend hot-reload)

Run the backend services in Docker and the Next.js frontend locally for fast iteration.

```bash
git clone https://github.com/jackalope-code/shopdeck.git
cd shopdeck
npm install

# Start Postgres + Redis only (no API container)
cd backend
npm run docker:services:dev

# In a separate terminal — start the Express API directly
npm run dev     # from backend/

# In another terminal — start Next.js with hot reload
cd ..
npm run dev
```

Create `backend/.env` (copy from `backend/.env.example`) and set at minimum:

```env
PGHOST=localhost
PGPORT=5432
PGDATABASE=shopdeck
PGUSER=shopdeck
POSTGRES_PASSWORD=shopdeck_dev
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=shopdeck-dev-secret-change-in-prod
```

---

## Build

```bash
npm run build
```

> **Note:** `backend/.env` and `.env.local` contain secrets — never commit them.

