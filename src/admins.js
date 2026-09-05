const db = require("./db");
const config = require("./config");

const listStmt = db.prepare("SELECT * FROM admins ORDER BY added_at ASC");
const isDbAdminStmt = db.prepare("SELECT 1 FROM admins WHERE discord_user_id = ?");
const addStmt = db.prepare("INSERT OR IGNORE INTO admins (discord_user_id, added_by, added_at) VALUES (?, ?, ?)");
const removeStmt = db.prepare("DELETE FROM admins WHERE discord_user_id = ?");

/** The full effective admin set: the .env-seeded list (fixed, requires a
 * restart to change) plus whoever has been added at runtime via /admins. */
function isAdmin(discordUserId) {
  return config.adminUserIds.has(discordUserId) || !!isDbAdminStmt.get(discordUserId);
}

function isSeedAdmin(discordUserId) {
  return config.adminUserIds.has(discordUserId);
}

function add(discordUserId, addedBy) {
  addStmt.run(discordUserId, addedBy, new Date().toISOString());
}

function remove(discordUserId) {
  removeStmt.run(discordUserId);
}

function listRuntimeAdmins() {
  return listStmt.all();
}

module.exports = { isAdmin, isSeedAdmin, add, remove, listRuntimeAdmins };
