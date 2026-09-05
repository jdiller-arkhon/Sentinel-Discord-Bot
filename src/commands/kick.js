const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { hasPermission } = require("../authz");
const { infoEmbed } = require("../embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member from the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((opt) => opt.setName("user").setDescription("Who to kick").setRequired(true))
    .addStringOption((opt) => opt.setName("reason").setDescription("Why").setRequired(false)),

  async execute(interaction) {
    if (!hasPermission(interaction, PermissionFlagsBits.KickMembers)) {
      return interaction.reply({ embeds: [infoEmbed({ title: "Not authorized", description: "Requires Kick Members.", color: 0xed4245 })], ephemeral: true });
    }

    const targetUser = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason", false);

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      return interaction.reply({ embeds: [infoEmbed({ title: "Not found", description: "That user isn't in this server.", color: 0x8a8f98 })], ephemeral: true });
    }
    if (!member.kickable) {
      return interaction.reply({
        embeds: [infoEmbed({ title: "Can't kick", description: "I don't have permission to kick that member (role hierarchy).", color: 0xed4245 })],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });
    await member.kick(reason || undefined);

    await interaction.editReply({
      embeds: [infoEmbed({ title: "👢 Kicked", description: `${targetUser.tag} was kicked.${reason ? `\nReason: ${reason}` : ""}`, color: 0xf5a623 })],
    });
  },
};
