-- ShopDeck PostgreSQL schema
-- Applied automatically by Docker on first boot via /docker-entrypoint-initdb.d/

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  username     TEXT UNIQUE NOT NULL,
  email        TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_developer BOOLEAN NOT NULL DEFAULT false,
  github_token TEXT,
  github_username TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── User profile (settings) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id        TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  active_widgets JSONB    NOT NULL DEFAULT '[]',
  widget_order   JSONB,
  grid_cols      INTEGER  NOT NULL DEFAULT 3,
  feed_config    JSONB    NOT NULL DEFAULT '{}',
  ai_config      JSONB    NOT NULL DEFAULT '{"provider":"openai","model":"gpt-4o","apiKey":""}',
  api_keys       JSONB    NOT NULL DEFAULT '{}',
  browser_alerts BOOLEAN  NOT NULL DEFAULT false,
  ai_perms       JSONB    NOT NULL DEFAULT '{"projects":false,"inventory":false,"watchlist":false,"deals":false}',
  ram_alert_states JSONB  NOT NULL DEFAULT '{}',
  gpu_alert_states JSONB  NOT NULL DEFAULT '{}',
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── AI conversation history ──────────────────────────────────────────────────
-- messages: JSON array of {role, content} objects (max 50 entries, ~100k chars enforced in app)
CREATE TABLE IF NOT EXISTS ai_history (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  messages   JSONB       NOT NULL DEFAULT '[]',
  char_count INTEGER     NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Tracked price alerts ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tracked_alerts (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  alerts     JSONB       NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Alert history (fired notifications) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_history (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  entries    JSONB       NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Electronics watchlists ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_watchlists (
  user_id   TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  watchlist JSONB       NOT NULL DEFAULT '{"digikey":[],"mouser":[]}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
