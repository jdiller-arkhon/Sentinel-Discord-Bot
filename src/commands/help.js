const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder().setName("help").setDescription("How this bot works"),

  async execute(interaction) {
    await interaction.reply({
      ephemeral: true,
      content: [
        "**Sentinel review bot**",
        "New AI strategy proposals from your Sentinel instance post here automatically, with Approve/Reject buttons.",
        "- Approving a momentum parameter tweak applies it immediately through Sentinel's audited path.",
        "- Anything else (a mean-reversion tweak, a new-strategy idea) is only acknowledged — no automatic change exists for it yet. The bot always tells you honestly which happened.",
        "- `/status` — check whether this channel's connection to Sentinel is healthy.",
        "- Only you (and whoever set this channel up) can see it or press its buttons.",
      ].join("\n"),
    });
  },
};
