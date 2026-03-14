-- ShopDeck PostgreSQL schema
-- Applied automatically by Docker on first boot via /docker-entrypoint-initdb.d/

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  username     TEXT UNIQUE NOT NULL,
  email        TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  account_verified BOOLEAN NOT NULL DEFAULT false,
  email_verified_at TIMESTAMPTZ,
  is_demo BOOLEAN NOT NULL DEFAULT false,
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

-- ─── Product view history ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS view_history (
  user_id    TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url        TEXT        NOT NULL,
  name       TEXT        NOT NULL,
  vendor     TEXT,
  image      TEXT,
  price      TEXT,
  category   TEXT,
  view_count INTEGER     NOT NULL DEFAULT 1,
  viewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, url)
);
CREATE INDEX IF NOT EXISTS view_history_user_viewed_idx ON view_history(user_id, viewed_at DESC);

-- ─── Product favorites ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_favorites (
  user_id      TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url          TEXT        NOT NULL,
  name         TEXT        NOT NULL,
  vendor       TEXT,
  image        TEXT,
  price        TEXT,
  category     TEXT,
  favorited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, url)
);
CREATE INDEX IF NOT EXISTS user_favorites_user_favorited_idx ON user_favorites(user_id, favorited_at DESC);

-- ─── Electronics watchlists ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_watchlists (
  user_id   TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  watchlist JSONB       NOT NULL DEFAULT '{"digikey":[],"mouser":[]}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Manual list items (user-curated sources) ──────────────────────────────
CREATE TABLE IF NOT EXISTS manual_list_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  list_id    TEXT NOT NULL,
  name       TEXT NOT NULL,
  url        TEXT,
  price      TEXT,
  image      TEXT,
  notes      TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS manual_list_items_user_list_idx ON manual_list_items(user_id, list_id);

-- ─── Webhooks (inbound ring-buffer sources) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS webhooks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  secret     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS webhooks_user_id_idx ON webhooks(user_id);

-- ─── Email verification ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS email_verification_tokens_user_idx ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS email_verification_tokens_expires_idx ON email_verification_tokens(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS email_verification_tokens_hash_idx ON email_verification_tokens(token_hash);

CREATE TABLE IF NOT EXISTS email_verification_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash     TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  used_at       TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS email_verification_codes_user_idx ON email_verification_codes(user_id);
CREATE INDEX IF NOT EXISTS email_verification_codes_expires_idx ON email_verification_codes(expires_at);
CREATE INDEX IF NOT EXISTS email_verification_codes_hash_idx ON email_verification_codes(code_hash);

-- ─── Migrations (safe to re-run) ─────────────────────────────────────────────
-- Adds columns that were introduced after the initial schema deployment.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_username TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS widget_order JSONB;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS api_keys JSONB NOT NULL DEFAULT '{}';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS browser_alerts BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS ai_perms JSONB NOT NULL DEFAULT '{"projects":false,"inventory":false,"watchlist":false,"deals":false}';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS ram_alert_states JSONB NOT NULL DEFAULT '{}';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS gpu_alert_states JSONB NOT NULL DEFAULT '{}';

-- Nullify any previously stored plaintext GitHub tokens.
-- After this migration, users must re-connect GitHub. New tokens are encrypted (AES-256-GCM).
-- This runs on every startup but is idempotent: encrypted tokens contain ':' so they won't
-- match the simple check here. Plaintext GitHub tokens start with 'ghp_' or 'gho_'.
UPDATE users SET github_token = NULL WHERE github_token IS NOT NULL AND github_token NOT LIKE '%:%';

-- Wipe plaintext api_keys (all values before this migration are plaintext).
-- Users must re-enter API keys in Settings after this runs.
-- Idempotent: encrypted format is hex:hex:hex; plaintext keys don't match that pattern.
UPDATE user_profiles SET api_keys = '{}'::jsonb
  WHERE api_keys::text != '{}'
    AND (
      SELECT count(*) FROM jsonb_each_text(api_keys) WHERE value !~ '^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$'
    ) > 0;

-- Wipe plaintext AI provider API keys stored in ai_config.apiKey.
-- Idempotent: encrypted values match hex:hex:hex; plaintext keys do not.
UPDATE user_profiles
  SET ai_config = jsonb_set(ai_config, '{apiKey}', '""'::jsonb)
  WHERE (ai_config->>'apiKey') != ''
    AND (ai_config->>'apiKey') IS NOT NULL
    AND (ai_config->>'apiKey') !~ '^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$';

-- Wipe plaintext webhook secrets.
-- Idempotent: encrypted values match hex:hex:hex; plaintext secrets do not.
UPDATE webhooks
  SET secret = NULL
  WHERE secret IS NOT NULL
    AND secret !~ '^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$';
