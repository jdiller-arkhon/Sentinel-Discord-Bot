const { SlashCommandBuilder } = require("discord.js");
const db = require("../db");
const { isOwnerOrAdmin } = require("../authz");
const { SentinelClient } = require("../sentinelClient");
const { infoEmbed, truncate } = require("../embeds");

const getByChannel = db.prepare("SELECT * FROM customers WHERE channel_id = ?");
const HISTORY_LIMIT = 5;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("history")
    .setDescription("Show the most recently approved/rejected proposals"),

  async execute(interaction) {
    const customer = getByChannel.get(interaction.channelId);
    if (!customer) {
      return interaction.reply({
        embeds: [infoEmbed({ title: "Not linked", description: "This channel isn't linked to a Sentinel instance.", color: 0x8a8f98 })],
        ephemeral: true,
      });
    }
    if (!isOwnerOrAdmin(customer, interaction.user.id)) {
      return interaction.reply({
        embeds: [infoEmbed({ title: "Not authorized", description: "Only the client this channel belongs to can do that.", color: 0xed4245 })],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const sentinel = SentinelClient.forCustomer(customer);
    let approved, rejected;
    try {
      [approved, rejected] = await Promise.all([sentinel.getProposals("approved"), sentinel.getProposals("rejected")]);
    } catch (err) {
      return interaction.editReply({
        embeds: [infoEmbed({ title: "Couldn't reach Sentinel", description: `\`${err.message}\``, color: 0xed4245 })],
      });
    }

    const combined = [...approved, ...rejected]
      .sort((a, b) => new Date(b.reviewed_at) - new Date(a.reviewed_at))
      .slice(0, HISTORY_LIMIT);

    if (combined.length === 0) {
      return interaction.editReply({ embeds: [infoEmbed({ title: "History", description: "No reviewed proposals yet." })] });
    }

    const fields = combined.map((p) => {
      const when = p.reviewed_at ? new Date(p.reviewed_at).toLocaleString() : "unknown time";
      const what = p.proposal_type === "parameter_tweak" ? `${p.target_strategy ?? "?"} parameter tweak` : "new strategy idea";
      const icon = p.status === "approved" ? "✅" : "⛔";
      return {
        name: `${icon} ${what} — ${when}`,
        value: truncate(p.rationale || "_(no rationale)_", 200),
      };
    });

    await interaction.editReply({ embeds: [infoEmbed({ title: `${customer.name} — Recent Decisions`, fields })] });
  },
};
