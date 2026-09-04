-- Sentinel Discord Bot — Cloudflare D1 schema (single shared-bot / per-channel model)
--
-- There is only ONE Discord Application (yours) and ONE bot token, used for every
-- customer. Each customer gets a private channel inside your Discord server,
-- created automatically when they redeem their activation token with /activate.
-- Your own bot's proposals use the special row with license_key = 'ADMIN'.

CREATE TABLE IF NOT EXISTS licenses (
  license_key TEXT PRIMARY KEY,          -- also doubles as the activation token
  customer_name TEXT NOT NULL,
  discord_channel_id TEXT,               -- set on activation
  discord_allowed_user_id TEXT,          -- set on activation (whoever redeemed the token)
  sentinel_base_url TEXT,                -- set on activation
  sentinel_token TEXT,                   -- optional: sent as X-Sentinel-Token if Sentinel checks it
  activated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  activated_at TEXT,
  revoked INTEGER NOT NULL DEFAULT 0,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS posted_proposals (
  license_key TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  posted_at TEXT NOT NULL,
  PRIMARY KEY (license_key, proposal_id)
);
