-- Sentinel Discord Bot — Cloudflare D1 schema
-- Both your own admin bot and every customer sub-bot live as rows here.
-- The admin row (is_admin = 1) is the only one whose /license commands are honored.

CREATE TABLE IF NOT EXISTS licenses (
  license_key TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  discord_application_id TEXT NOT NULL UNIQUE,
  discord_public_key TEXT NOT NULL,
  discord_bot_token TEXT NOT NULL,
  discord_channel_id TEXT NOT NULL,
  discord_allowed_user_id TEXT NOT NULL,
  sentinel_base_url TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  revoked_at TEXT
);

-- Short-lived staging row between `/license create` (collects everything except
-- the bot token as command options) and the follow-up modal (collects just the
-- token). Keeps the token out of chat history entirely. Deleted once consumed.
CREATE TABLE IF NOT EXISTS pending_creates (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  discord_application_id TEXT NOT NULL,
  discord_public_key TEXT NOT NULL,
  discord_channel_id TEXT NOT NULL,
  discord_allowed_user_id TEXT NOT NULL,
  sentinel_base_url TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posted_proposals (
  license_key TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  posted_at TEXT NOT NULL,
  PRIMARY KEY (license_key, proposal_id)
);
