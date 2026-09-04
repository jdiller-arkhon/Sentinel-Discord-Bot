const { SlashCommandBuilder } = require("discord.js");
const db = require("../db");
const { isOwnerOrAdmin } = require("../authz");
const { SentinelClient } = require("../sentinelClient");
const { truncate } = require("../embeds");

const getByChannel = db.prepare("SELECT * FROM customers WHERE channel_id = ?");
const HISTORY_LIMIT = 5;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("history")
    .setDescription("Show the most recently approved/rejected proposals"),

  async execute(interaction) {
    const customer = getByChannel.get(interaction.channelId);
    if (!customer) {
      return interaction.reply({ content: "This channel isn't linked to a Sentinel instance.", ephemeral: true });
    }
    if (!isOwnerOrAdmin(customer, interaction.user.id)) {
      return interaction.reply({ content: "Only the client this channel belongs to can do that.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const sentinel = new SentinelClient({ baseUrl: customer.sentinel_base_url, token: customer.sentinel_token });
    let approved, rejected;
    try {
      [approved, rejected] = await Promise.all([sentinel.getProposals("approved"), sentinel.getProposals("rejected")]);
    } catch (err) {
      return interaction.editReply(`Couldn't reach Sentinel: \`${err.message}\``);
    }

    const combined = [...approved, ...rejected]
      .sort((a, b) => new Date(b.reviewed_at) - new Date(a.reviewed_at))
      .slice(0, HISTORY_LIMIT);

    if (combined.length === 0) {
      return interaction.editReply("No reviewed proposals yet.");
    }

    const lines = combined.map((p) => {
      const when = p.reviewed_at ? new Date(p.reviewed_at).toLocaleString() : "unknown time";
      const what =
        p.proposal_type === "parameter_tweak"
          ? `${p.target_strategy ?? "?"} parameter tweak`
          : "new strategy idea";
      const icon = p.status === "approved" ? "✅" : "❌";
      return `${icon} **${what}** — ${p.status} at ${when}\n   ${truncate(p.rationale || "(no rationale)", 150)}`;
    });

    await interaction.editReply(lines.join("\n\n"));
  },
};
