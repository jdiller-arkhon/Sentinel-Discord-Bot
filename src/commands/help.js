const { SlashCommandBuilder } = require("discord.js");
const { infoEmbed } = require("../embeds");

module.exports = {
  data: new SlashCommandBuilder().setName("help").setDescription("How this bot works"),

  async execute(interaction) {
    const embed = infoEmbed({
      title: "How This Works",
      description:
        "New AI strategy proposals from your Sentinel instance post here automatically, with Approve/Reject buttons.\n\n" +
        "✅ Approving a **momentum** parameter tweak applies it immediately through Sentinel's audited path.\n" +
        "⛔ Anything else (a mean-reversion tweak, a new-strategy idea) is only acknowledged — no automatic change " +
        "exists for it yet. The bot always tells you honestly which happened.",
      fields: [
        { name: "/status", value: "Check whether this channel's connection to Sentinel is healthy.", inline: true },
        { name: "/pending", value: "Check Sentinel right now instead of waiting for the next automatic poll.", inline: true },
        { name: "/history", value: "See your 5 most recently approved/rejected proposals.", inline: true },
        { name: "/audit", value: "See who approved/rejected what in this channel, and when.", inline: true },
        { name: "/pause · /resume", value: "Temporarily stop or restart new proposals posting here.", inline: true },
      ],
    });
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
