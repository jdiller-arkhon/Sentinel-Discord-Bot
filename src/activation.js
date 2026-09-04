const crypto = require("crypto");
const db = require("./db");

const CODE_BYTES = 16; // 128 bits of entropy — brute force is impractical
const CODE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MAX_FAILURES = 5;

function hashCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function generateActivationCode() {
  const code = crypto.randomBytes(CODE_BYTES).toString("hex");
  return {
    code,
    hash: hashCode(code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  };
}

const recordAttemptStmt = db.prepare(
  "INSERT INTO activation_attempts (discord_user_id, success, created_at) VALUES (?, ?, ?)"
);
const countRecentFailuresStmt = db.prepare(
  "SELECT COUNT(*) AS n FROM activation_attempts WHERE discord_user_id = ? AND success = 0 AND created_at > ?"
);

function recordAttempt(discordUserId, success) {
  recordAttemptStmt.run(discordUserId, success ? 1 : 0, new Date().toISOString());
}

/** True if this Discord user has hit the failed-attempt ceiling recently. */
function isLockedOut(discordUserId) {
  const since = new Date(Date.now() - LOCKOUT_WINDOW_MS).toISOString();
  const { n } = countRecentFailuresStmt.get(discordUserId, since);
  return n >= LOCKOUT_MAX_FAILURES;
}

const findPendingByHashStmt = db.prepare(
  "SELECT * FROM customers WHERE activation_code_hash = ? AND activated = 0"
);

/** Returns the pending customer row for a code, or null if it doesn't
 * match anything, or it matched but has expired. Expiry is checked here
 * (not in SQL) so an expired-but-matching code is a normal "invalid
 * code" outcome rather than a distinguishable code path. */
function findPendingCustomerByCode(code) {
  const row = findPendingByHashStmt.get(hashCode(code));
  if (!row) return null;
  if (row.activation_code_expires_at && new Date(row.activation_code_expires_at) < new Date()) return null;
  return row;
}

module.exports = {
  generateActivationCode,
  hashCode,
  recordAttempt,
  isLockedOut,
  findPendingCustomerByCode,
  LOCKOUT_WINDOW_MS,
  LOCKOUT_MAX_FAILURES,
  CODE_TTL_MS,
};
