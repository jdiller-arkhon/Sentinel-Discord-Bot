const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { hasPermission } = require("../authz");
const { infoEmbed } = require("../embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user from the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((opt) => opt.setName("user").setDescription("Who to ban").setRequired(true))
    .addStringOption((opt) => opt.setName("reason").setDescription("Why").setRequired(false))
    .addIntegerOption((opt) =>
      opt.setName("delete_message_days").setDescription("Also delete their recent messages (0-7 days)").setMinValue(0).setMaxValue(7).setRequired(false)
    ),

  async execute(interaction) {
    if (!hasPermission(interaction, PermissionFlagsBits.BanMembers)) {
      return interaction.reply({ embeds: [infoEmbed({ title: "Not authorized", description: "Requires Ban Members.", color: 0xed4245 })], ephemeral: true });
    }

    const targetUser = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason", false);
    const deleteMessageDays = interaction.options.getInteger("delete_message_days", false) ?? 0;

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (member && !member.bannable) {
      return interaction.reply({
        embeds: [infoEmbed({ title: "Can't ban", description: "I don't have permission to ban that member (role hierarchy).", color: 0xed4245 })],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });
    await interaction.guild.members.ban(targetUser.id, {
      reason: reason || undefined,
      deleteMessageSeconds: deleteMessageDays * 24 * 60 * 60,
    });

    await interaction.editReply({
      embeds: [infoEmbed({ title: "🔨 Banned", description: `${targetUser.tag} was banned.${reason ? `\nReason: ${reason}` : ""}`, color: 0xed4245 })],
    });
  },
};
