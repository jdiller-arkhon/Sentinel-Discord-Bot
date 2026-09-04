const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const config = require("./config");

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
const db = new Database(config.dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    discord_user_id TEXT NOT NULL,
    channel_id TEXT NOT NULL UNIQUE,
    sentinel_base_url TEXT NOT NULL,
    sentinel_token TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    alerted_failure INTEGER NOT NULL DEFAULT 0,
    last_poll_at TEXT,
    last_poll_ok INTEGER,
    last_error TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS posted_proposals (
    customer_id TEXT NOT NULL,
    proposal_id TEXT NOT NULL,
    message_id TEXT,
    posted_at TEXT NOT NULL,
    PRIMARY KEY (customer_id, proposal_id)
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id TEXT NOT NULL,
    proposal_id TEXT NOT NULL,
    action TEXT NOT NULL,
    discord_user_id TEXT NOT NULL,
    discord_username TEXT,
    result TEXT,
    created_at TEXT NOT NULL
  );
`);

module.exports = db;
