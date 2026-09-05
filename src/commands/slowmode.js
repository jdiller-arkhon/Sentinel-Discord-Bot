const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { hasPermission } = require("../authz");
const { infoEmbed } = require("../embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Set (or clear) this channel's slowmode delay")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption((opt) =>
      opt.setName("seconds").setDescription("Delay between messages, 0 to disable (max 21600 = 6h)").setMinValue(0).setMaxValue(21600).setRequired(true)
    ),

  async execute(interaction) {
    if (!hasPermission(interaction, PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({ embeds: [infoEmbed({ title: "Not authorized", description: "Requires Manage Channels.", color: 0xed4245 })], ephemeral: true });
    }

    const seconds = interaction.options.getInteger("seconds", true);
    await interaction.deferReply();
    await interaction.channel.setRateLimitPerUser(seconds);

    await interaction.editReply({
      embeds: [
        infoEmbed({
          title: seconds === 0 ? "Slowmode disabled" : "🐌 Slowmode set",
          description: seconds === 0 ? "Members can send messages freely again." : `Members must wait ${seconds}s between messages.`,
          color: seconds === 0 ? 0x2ecc71 : 0xf5a623,
        }),
      ],
    });
  },
};
