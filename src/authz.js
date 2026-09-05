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

/** Discord moderation commands (purge/timeout/kick/ban/etc.) gate on the
 * invoking member's actual server permissions, not the Sentinel-specific
 * admin list above — a server's own Moderator role should be able to
 * use them without also being a Sentinel admin, and vice versa. Slash
 * commands also declare setDefaultMemberPermissions() so Discord hides
 * them from members without the permission in the first place; this is
 * the runtime backstop for when a server owner has changed that default
 * in Integrations settings. */
function hasPermission(interaction, permissionFlag) {
  return interaction.memberPermissions?.has(permissionFlag) ?? false;
}

module.exports = { isOwnerOrAdmin, isAdmin, hasPermission };
