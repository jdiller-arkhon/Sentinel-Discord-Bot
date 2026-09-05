const db = require("./db");

const insertStmt = db.prepare(`
  INSERT INTO security_events (event_type, discord_user_id, discord_username, detail, created_at)
  VALUES (@eventType, @discordUserId, @discordUsername, @detail, @createdAt)
`);
const listRecentStmt = db.prepare("SELECT * FROM security_events ORDER BY created_at DESC LIMIT ?");

/** A general security-relevant event log — separate from audit_log
 * (which only ever records real approve/reject decisions). Covers
 * things like a denied admin-command attempt, an admin being
 * added/removed, a client being revoked, maintenance mode being
 * toggled, or a client's token being changed — the kind of activity a
 * security review would ask "who did this and when?" about. */
function record(eventType, { discordUserId, discordUsername, detail } = {}) {
  try {
    insertStmt.run({
      eventType,
      discordUserId: discordUserId || null,
      discordUsername: discordUsername || null,
      detail: detail || null,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("failed to record security event", err);
  }
}

function listRecent(limit = 20) {
  return listRecentStmt.all(limit);
}

module.exports = { record, listRecent };
