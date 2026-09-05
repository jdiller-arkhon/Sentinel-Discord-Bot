const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const db = require("../db");
const { hasPermission } = require("../authz");
const { infoEmbed } = require("../embeds");

const listWarnings = db.prepare(
  "SELECT * FROM warnings WHERE guild_id = ? AND target_user_id = ? ORDER BY created_at DESC LIMIT 20"
);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("View a member's warning history")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) => opt.setName("user").setDescription("Whose warnings to view").setRequired(true)),

  async execute(interaction) {
    if (!hasPermission(interaction, PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({ embeds: [infoEmbed({ title: "Not authorized", description: "Requires Moderate Members.", color: 0xed4245 })], ephemeral: true });
    }

    const targetUser = interaction.options.getUser("user", true);
    const rows = listWarnings.all(interaction.guildId, targetUser.id);

    if (rows.length === 0) {
      return interaction.reply({ embeds: [infoEmbed({ title: `${targetUser.tag} — Warnings`, description: "No warnings on record." })], ephemeral: true });
    }

    const description = rows
      .map((r, i) => `**${i + 1}.** ${r.reason} — by <@${r.moderator_user_id}> · ${new Date(r.created_at).toLocaleString()}`)
      .join("\n");

    await interaction.reply({ embeds: [infoEmbed({ title: `${targetUser.tag} — ${rows.length} Warning(s)`, description, color: 0xf5a623 })], ephemeral: true });
  },
};
