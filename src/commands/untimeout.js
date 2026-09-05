const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { hasPermission } = require("../authz");
const { infoEmbed } = require("../embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove an active timeout/mute from a member")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) => opt.setName("user").setDescription("Who to un-mute").setRequired(true)),

  async execute(interaction) {
    if (!hasPermission(interaction, PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({ embeds: [infoEmbed({ title: "Not authorized", description: "Requires Moderate Members.", color: 0xed4245 })], ephemeral: true });
    }

    const targetUser = interaction.options.getUser("user", true);
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      return interaction.reply({ embeds: [infoEmbed({ title: "Not found", description: "That user isn't in this server.", color: 0x8a8f98 })], ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    await member.timeout(null);

    await interaction.editReply({
      embeds: [infoEmbed({ title: "🔊 Timeout removed", description: `${targetUser} can speak again.`, color: 0x2ecc71 })],
    });
  },
};
