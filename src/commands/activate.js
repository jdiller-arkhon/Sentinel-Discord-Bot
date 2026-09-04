const { SlashCommandBuilder } = require("discord.js");
const db = require("../db");
const config = require("../config");
const { recordAttempt, isLockedOut, findPendingCustomerByCode, LOCKOUT_MAX_FAILURES } = require("../activation");

const claimStmt = db.prepare(`
  UPDATE customers
  SET discord_user_id = @discordUserId, activated = 1, activation_code_hash = NULL, activation_code_expires_at = NULL
  WHERE id = @id
`);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("activate")
    .setDescription("Claim your private Sentinel review channel with the code you were given")
    .addStringOption((opt) => opt.setName("code").setDescription("Your activation code").setRequired(true)),

  async execute(interaction) {
    const userId = interaction.user.id;

    if (isLockedOut(userId)) {
      // Deliberately generic message and no code lookup at all once
      // locked out — don't let attempts continue to probe.
      return interaction.reply({
        content: `Too many failed attempts. Try again in a few minutes, or contact support.`,
        ephemeral: true,
      });
    }

    const code = interaction.options.getString("code", true).trim();
    const customer = findPendingCustomerByCode(code);

    if (!customer) {
      recordAttempt(userId, false);
      const remaining = LOCKOUT_MAX_FAILURES - 1; // best-effort hint, not exact across races
      return interaction.reply({
        content: `That code is invalid or expired. (${remaining} attempts remaining before a temporary lockout.)`,
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const guild = await interaction.client.guilds.fetch(config.guildId);
    const channel = await guild.channels.fetch(customer.channel_id).catch(() => null);
    if (!channel) {
      recordAttempt(userId, false);
      return interaction.editReply("That code matched, but its channel no longer exists. Contact support.");
    }

    await channel.permissionOverwrites.edit(userId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    });

    claimStmt.run({ id: customer.id, discordUserId: userId });
    recordAttempt(userId, true);

    await channel.send(
      `Welcome, <@${userId}>! This is your private Sentinel review channel. ` +
        "New AI strategy proposals will show up here with Approve/Reject buttons as they come in. " +
        "Run `/status` any time to check the connection, or `/help` for more."
    );

    await interaction.editReply(`Activated — ${channel} is now yours.`);
  },
};
