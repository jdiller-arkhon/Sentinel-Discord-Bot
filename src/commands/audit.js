const { SlashCommandBuilder } = require("discord.js");
const db = require("../db");
const { isOwnerOrAdmin } = require("../authz");
const { truncate } = require("../embeds");

const getByChannel = db.prepare("SELECT * FROM customers WHERE channel_id = ?");
const getRecentAudit = db.prepare(
  "SELECT * FROM audit_log WHERE customer_id = ? ORDER BY created_at DESC LIMIT ?"
);
const AUDIT_LIMIT = 10;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("audit")
    .setDescription("Show who approved/rejected what in this channel, and when"),

  async execute(interaction) {
    const customer = getByChannel.get(interaction.channelId);
    if (!customer) {
      return interaction.reply({ content: "This channel isn't linked to a Sentinel instance.", ephemeral: true });
    }
    if (!isOwnerOrAdmin(customer, interaction.user.id)) {
      return interaction.reply({ content: "Only the client this channel belongs to can do that.", ephemeral: true });
    }

    const rows = getRecentAudit.all(customer.id, AUDIT_LIMIT);
    if (rows.length === 0) {
      return interaction.reply({ content: "No approve/reject actions recorded yet.", ephemeral: true });
    }

    const lines = rows.map((r) => {
      const icon = r.action === "approve" ? "✅" : "❌";
      const who = r.discord_username || r.discord_user_id;
      const when = new Date(r.created_at).toLocaleString();
      const outcome = r.result === "ok" ? "" : ` (${truncate(r.result, 80)})`;
      return `${icon} ${r.action} proposal \`${r.proposal_id.slice(0, 8)}\` by **${who}** at ${when}${outcome}`;
    });

    await interaction.reply({ content: lines.join("\n"), ephemeral: true });
  },
};
