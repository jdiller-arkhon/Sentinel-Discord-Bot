const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { hasPermission } = require("../authz");
const { infoEmbed } = require("../embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Remove a ban by user ID (banned users can't be picked from a member list)")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption((opt) => opt.setName("user_id").setDescription("The banned user's Discord ID").setRequired(true)),

  async execute(interaction) {
    if (!hasPermission(interaction, PermissionFlagsBits.BanMembers)) {
      return interaction.reply({ embeds: [infoEmbed({ title: "Not authorized", description: "Requires Ban Members.", color: 0xed4245 })], ephemeral: true });
    }

    const userId = interaction.options.getString("user_id", true).trim();
    if (!/^\d{17,20}$/.test(userId)) {
      return interaction.reply({ embeds: [infoEmbed({ title: "Invalid ID", description: "That doesn't look like a Discord user ID.", color: 0xed4245 })], ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const banEntry = await interaction.guild.bans.fetch(userId).catch(() => null);
    if (!banEntry) {
      return interaction.editReply({ embeds: [infoEmbed({ title: "Not banned", description: "No ban found for that user ID.", color: 0x8a8f98 })] });
    }

    await interaction.guild.members.unban(userId);
    await interaction.editReply({
      embeds: [infoEmbed({ title: "Unbanned", description: `${banEntry.user.tag} can rejoin the server.`, color: 0x2ecc71 })],
    });
  },
};
