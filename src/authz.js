const admins = require("./admins");
const securityLog = require("./securityLog");

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

/** Checks Sentinel-admin access for a slash command and, if denied,
 * records it to the security log — the one thing that made
 * securityLog.js dead code before: every "not authorized" branch used
 * to check isAdmin() directly and never logged the denial. Returns
 * true/false like isAdmin(); the caller still owns the reply. */
function checkAdmin(interaction, commandName) {
  const ok = isAdmin(interaction.user.id);
  if (!ok) {
    securityLog.record("admin_command_denied", {
      discordUserId: interaction.user.id,
      discordUsername: interaction.user.tag,
      detail: `/${commandName}`,
    });
  }
  return ok;
}

module.exports = { isOwnerOrAdmin, isAdmin, hasPermission, checkAdmin };
