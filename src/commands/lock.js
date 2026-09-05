const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { hasPermission } = require("../authz");
const { infoEmbed } = require("../embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Stop @everyone from sending messages in this channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((opt) => opt.setName("reason").setDescription("Why").setRequired(false)),

  async execute(interaction) {
    if (!hasPermission(interaction, PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({ embeds: [infoEmbed({ title: "Not authorized", description: "Requires Manage Channels.", color: 0xed4245 })], ephemeral: true });
    }

    const reason = interaction.options.getString("reason", false);
    await interaction.deferReply();

    await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });

    await interaction.editReply({
      embeds: [infoEmbed({ title: "🔒 Channel locked", description: reason || "Only members with an explicit override can send messages.", color: 0xed4245 })],
    });
  },
};
