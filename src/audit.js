const db = require("./db");

const insertStmt = db.prepare(`
  INSERT INTO audit_log (customer_id, proposal_id, action, discord_user_id, discord_username, result, created_at)
  VALUES (@customerId, @proposalId, @action, @discordUserId, @discordUsername, @result, @createdAt)
`);

/**
 * Records who clicked what, independent of Discord's own message history
 * (which can be edited/deleted and isn't queryable). Never throws — a
 * broken audit write shouldn't block the actual approve/reject action.
 */
function recordAudit({ customerId, proposalId, action, discordUserId, discordUsername, result }) {
  try {
    insertStmt.run({
      customerId,
      proposalId,
      action,
      discordUserId,
      discordUsername: discordUsername || null,
      result: result || null,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("failed to record audit entry", err);
  }
}

module.exports = { recordAudit };
