# ShopDeck

A keyboard/electronics deal tracker and project manager built with Next.js, Express, PostgreSQL, and Redis.

<img width="3822" height="1795" alt="Screenshot 2026-03-09 180716" src="https://github.com/user-attachments/assets/35489334-648e-4e08-a8dc-6bf93b806799" />

## Stack

- **Frontend**: Next.js (React 19, TypeScript, Tailwind v4) — port 3000
- **Backend**: Express.js — port 4000
- **Database**: PostgreSQL 16
- **Cache**: Redis 7

---

## Development Setup (Docker — recommended)

The easiest way to run everything (backend + Postgres + Redis + demo account):

```bash
git clone https://github.com/jackalope-code/shopdeck.git
cd shopdeck

# Install frontend deps
npm install

# Start backend services (first run — creates DB + demo account)
cd backend
docker compose down -v   # wipe any old volume so seed runs
npm run docker:dev

# In a separate terminal, start the Next.js frontend
cd ..
npm run dev
```

Open **http://localhost:3000**.

### Demo account

| Field | Value |
|---|---|
| Username | `demo` |
| Password | `demo1234` |
| Email | `demo@shopdeck.local` |

> **Note:** The demo account is seeded by `backend/seed-demo.sql` on first Postgres init.
> If you already have a running Docker volume, run `docker compose down -v` first so the seed is applied.

### Subsequent starts

```bash
# Backend (from backend/)
npm run docker:dev

# Frontend (from project root)
npm run dev
```

---

## Development Setup (local Node — no Docker)

Requires a local PostgreSQL and Redis instance.

```bash
git clone https://github.com/jackalope-code/shopdeck.git
cd shopdeck
npm install

cd backend
npm install
node server.js   # starts on port 4000

# In a separate terminal
cd ..
npm run dev      # starts Next.js on port 3000
```

Create a `backend/.env` with:

```env
PGHOST=localhost
PGPORT=5432
PGDATABASE=shopdeck
PGUSER=shopdeck
PGPASSWORD=shopdeck_dev
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=shopdeck-dev-secret-change-in-prod
```

---

## Build

```bash
npm run build
```

> **Note:** `backend/users.json` and `.env` files contain sensitive data — never commit them.

