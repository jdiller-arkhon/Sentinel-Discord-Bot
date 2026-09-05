const { SlashCommandBuilder } = require("discord.js");
const { checkAdmin } = require("../authz");
const { infoEmbed } = require("../embeds");
const { pollAll } = require("../poller");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("poll-all")
    .setDescription("[admin] Force a full poll of every active client right now"),

  async execute(interaction) {
    if (!checkAdmin(interaction, "poll-all")) {
      return interaction.reply({ embeds: [infoEmbed({ title: "Not authorized", color: 0xed4245 })], ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    const result = await pollAll(interaction.client);

    if (result.skipped) {
      return interaction.editReply({
        embeds: [infoEmbed({ title: "Skipped", description: `Bot is in maintenance mode (${result.reason}).`, color: 0x8a8f98 })],
      });
    }

    await interaction.editReply({
      embeds: [
        infoEmbed({
          title: "Fleet poll complete",
          description: `Polled ${result.customerCount} active client(s), posted ${result.postedCount} new proposal(s) total.`,
          color: 0x2ecc71,
        }),
      ],
    });
  },
};
