const admins = require("./admins");

/** Same rule the button handler uses: the client this channel belongs
 * to, or an admin — never anyone else, even if they can somehow see the
 * channel. */
function isOwnerOrAdmin(customer, discordUserId) {
  return discordUserId === customer.discord_user_id || admins.isAdmin(discordUserId);
}

function isAdmin(discordUserId) {
  return admins.isAdmin(discordUserId);
}

module.exports = { isOwnerOrAdmin, isAdmin };
