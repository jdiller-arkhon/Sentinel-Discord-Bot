const { SlashCommandBuilder } = require("discord.js");
const { checkAdmin } = require("../authz");
const { infoEmbed, truncate } = require("../embeds");
const securityLog = require("../securityLog");

const EVENT_LABELS = {
  admin_command_denied: "🚫 Admin command denied",
  admin_added: "➕ Admin added",
  admin_removed: "➖ Admin removed",
  client_revoked: "🔒 Client revoked",
  client_transferred: "🔁 Client transferred",
  client_code_regenerated: "🔑 Activation code regenerated",
  client_token_changed: "🔐 Client token rotated",
  maintenance_enabled: "🔧 Maintenance enabled",
  maintenance_disabled: "🟢 Maintenance disabled",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("security-log")
    .setDescription("[admin] Recent security-relevant activity: denials, admin/client changes, maintenance toggles"),

  async execute(interaction) {
    if (!checkAdmin(interaction, "security-log")) {
      return interaction.reply({ embeds: [infoEmbed({ title: "Not authorized", color: 0xed4245 })], ephemeral: true });
    }

    const rows = securityLog.listRecent(20);
    if (rows.length === 0) {
      return interaction.reply({ embeds: [infoEmbed({ title: "Security Log", description: "Nothing recorded yet." })], ephemeral: true });
    }

    const description = rows
      .map((r) => {
        const label = EVENT_LABELS[r.event_type] || r.event_type;
        const who = r.discord_username || r.discord_user_id || "unknown";
        const when = new Date(r.created_at).toLocaleString();
        const detail = r.detail ? ` — ${truncate(r.detail, 120)}` : "";
        return `${label} — ${who} · ${when}${detail}`;
      })
      .join("\n");

    await interaction.reply({
      embeds: [infoEmbed({ title: `Security Log (last ${rows.length})`, description, color: 0xed4245 })],
      ephemeral: true,
    });
  },
};
