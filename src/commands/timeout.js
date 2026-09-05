const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { hasPermission } = require("../authz");
const { infoEmbed } = require("../embeds");

const MAX_TIMEOUT_MINUTES = 28 * 24 * 60; // Discord's own cap: 28 days

module.exports = {
  data: new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Mute a member for a set duration (Discord's native timeout)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) => opt.setName("user").setDescription("Who to mute").setRequired(true))
    .addIntegerOption((opt) => opt.setName("minutes").setDescription("Duration in minutes (max 40320 = 28 days)").setMinValue(1).setMaxValue(MAX_TIMEOUT_MINUTES).setRequired(true))
    .addStringOption((opt) => opt.setName("reason").setDescription("Why").setRequired(false)),

  async execute(interaction) {
    if (!hasPermission(interaction, PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({ embeds: [infoEmbed({ title: "Not authorized", description: "Requires Moderate Members.", color: 0xed4245 })], ephemeral: true });
    }

    const targetUser = interaction.options.getUser("user", true);
    const minutes = interaction.options.getInteger("minutes", true);
    const reason = interaction.options.getString("reason", false);

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      return interaction.reply({ embeds: [infoEmbed({ title: "Not found", description: "That user isn't in this server.", color: 0x8a8f98 })], ephemeral: true });
    }
    if (!member.moderatable) {
      return interaction.reply({
        embeds: [infoEmbed({ title: "Can't timeout", description: "I don't have permission to timeout that member (role hierarchy).", color: 0xed4245 })],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });
    await member.timeout(minutes * 60 * 1000, reason || undefined);

    await interaction.editReply({
      embeds: [
        infoEmbed({
          title: "🔇 Timed out",
          description: `${targetUser} is muted for ${minutes} minute(s).${reason ? `\nReason: ${reason}` : ""}`,
          color: 0xf5a623,
        }),
      ],
    });
  },
};
