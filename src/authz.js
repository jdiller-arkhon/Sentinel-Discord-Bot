const config = require("./config");

/** Same rule the button handler uses: the client this channel belongs
 * to, or an admin — never anyone else, even if they can somehow see the
 * channel. */
function isOwnerOrAdmin(customer, discordUserId) {
  return discordUserId === customer.discord_user_id || config.adminUserIds.has(discordUserId);
}

function isAdmin(discordUserId) {
  return config.adminUserIds.has(discordUserId);
}

module.exports = { isOwnerOrAdmin, isAdmin };
