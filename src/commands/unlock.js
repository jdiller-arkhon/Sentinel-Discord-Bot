const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { hasPermission } = require("../authz");
const { infoEmbed } = require("../embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Restore @everyone's ability to send messages in this channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    if (!hasPermission(interaction, PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({ embeds: [infoEmbed({ title: "Not authorized", description: "Requires Manage Channels.", color: 0xed4245 })], ephemeral: true });
    }

    await interaction.deferReply();
    // Clearing the overwrite (null) restores whatever the channel/category
    // otherwise grants, rather than force-setting SendMessages: true,
    // which would incorrectly override a role that's meant to stay muted.
    await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });

    await interaction.editReply({
      embeds: [infoEmbed({ title: "🔓 Channel unlocked", description: "Messaging is back to normal.", color: 0x2ecc71 })],
    });
  },
};
