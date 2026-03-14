# ShopDeck

A keyboard/electronics deal tracker and project manager built with Next.js, Express, PostgreSQL, and Redis.

<img width="3822" height="1795" alt="Screenshot 2026-03-09 180716" src="https://github.com/user-attachments/assets/35489334-648e-4e08-a8dc-6bf93b806799" />

## Stack

- **Frontend**: Next.js (React 19, TypeScript, Tailwind v4) — port 3000
- **Backend**: Express.js — port 4000
- **Database**: PostgreSQL 16
- **Cache**: Redis 7

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
* Sales data tracking broken

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

