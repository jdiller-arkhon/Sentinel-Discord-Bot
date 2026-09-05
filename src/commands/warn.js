const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const db = require("../db");
const { hasPermission } = require("../authz");
const { infoEmbed } = require("../embeds");

const insertWarning = db.prepare(`
  INSERT INTO warnings (guild_id, target_user_id, moderator_user_id, reason, created_at)
  VALUES (?, ?, ?, ?, ?)
`);
const countWarnings = db.prepare("SELECT COUNT(*) AS n FROM warnings WHERE guild_id = ? AND target_user_id = ?");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Log a warning for a member and DM them")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) => opt.setName("user").setDescription("Who to warn").setRequired(true))
    .addStringOption((opt) => opt.setName("reason").setDescription("Why").setRequired(true)),

  async execute(interaction) {
    if (!hasPermission(interaction, PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({ embeds: [infoEmbed({ title: "Not authorized", description: "Requires Moderate Members.", color: 0xed4245 })], ephemeral: true });
    }

    const targetUser = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason", true);

    await interaction.deferReply({ ephemeral: true });

    insertWarning.run(interaction.guildId, targetUser.id, interaction.user.id, reason, new Date().toISOString());
    const { n: totalWarnings } = countWarnings.get(interaction.guildId, targetUser.id);

    let dmSent = true;
    try {
      await targetUser.send({
        embeds: [infoEmbed({ title: "⚠️ You've been warned", description: `In **${interaction.guild.name}**:\n${reason}`, color: 0xf5a623 })],
      });
    } catch {
      dmSent = false; // DMs closed — not fatal, the warning is still recorded
    }

    await interaction.editReply({
      embeds: [
        infoEmbed({
          title: "Warning logged",
          description: `${targetUser} now has ${totalWarnings} warning(s).${dmSent ? "" : "\n_(couldn't DM them — their DMs are closed)_"}`,
          color: 0xf5a623,
        }),
      ],
    });
  },
};
