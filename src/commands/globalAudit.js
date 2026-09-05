const { SlashCommandBuilder } = require("discord.js");
const db = require("../db");
const { isAdmin } = require("../authz");
const { infoEmbed, truncate } = require("../embeds");

const getRecentGlobal = db.prepare(`
  SELECT audit_log.*, customers.name AS customer_name
  FROM audit_log
  JOIN customers ON customers.id = audit_log.customer_id
  ORDER BY audit_log.created_at DESC
  LIMIT ?
`);
const AUDIT_LIMIT = 15;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("global-audit")
    .setDescription("[admin] Recent approve/reject actions across every client"),

  async execute(interaction) {
    if (!isAdmin(interaction.user.id)) {
      return interaction.reply({ embeds: [infoEmbed({ title: "Not authorized", color: 0xed4245 })], ephemeral: true });
    }

    const rows = getRecentGlobal.all(AUDIT_LIMIT);
    if (rows.length === 0) {
      return interaction.reply({ embeds: [infoEmbed({ title: "Global Audit Trail", description: "No actions recorded yet." })], ephemeral: true });
    }

    const description = rows
      .map((r) => {
        const icon = r.action === "approve" ? "✅" : "⛔";
        const who = r.discord_username || r.discord_user_id;
        const when = new Date(r.created_at).toLocaleString();
        const outcome = r.result === "ok" ? "" : ` _(${truncate(r.result, 60)})_`;
        return `${icon} **${r.customer_name}** — \`${r.proposal_id.slice(0, 8)}\` ${r.action} by ${who} · ${when}${outcome}`;
      })
      .join("\n");

    await interaction.reply({ embeds: [infoEmbed({ title: `Global Audit Trail (last ${rows.length})`, description })], ephemeral: true });
  },
};
