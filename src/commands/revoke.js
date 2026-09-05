const { SlashCommandBuilder, ChannelType } = require("discord.js");
const db = require("../db");
const { isAdmin } = require("../authz");
const { infoEmbed } = require("../embeds");

const getByChannel = db.prepare("SELECT * FROM customers WHERE channel_id = ?");
const revokeStmt = db.prepare(`
  UPDATE customers
  SET active = 0, activated = 0, activation_code_hash = NULL, activation_code_expires_at = NULL
  WHERE id = ?
`);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("revoke")
    .setDescription("[admin] Fully revoke a client's access — stops polling and locks their channel")
    .addChannelOption((opt) =>
      opt.setName("channel").setDescription("The client's channel").addChannelTypes(ChannelType.GuildText).setRequired(true)
    )
    .addStringOption((opt) => opt.setName("reason").setDescription("Why (for the audit trail)").setRequired(false)),

  async execute(interaction) {
    if (!isAdmin(interaction.user.id)) {
      return interaction.reply({ embeds: [infoEmbed({ title: "Not authorized", color: 0xed4245 })], ephemeral: true });
    }

    const channel = interaction.options.getChannel("channel", true);
    const reason = interaction.options.getString("reason", false);
    const customer = getByChannel.get(channel.id);
    if (!customer) {
      return interaction.reply({
        embeds: [infoEmbed({ title: "Not found", description: `${channel} isn't linked to a Sentinel instance.`, color: 0x8a8f98 })],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    revokeStmt.run(customer.id);

    // Pull the client's own view access — revoking should actually shut
    // them out, not just stop the poller quietly in the background.
    const discordChannel = await interaction.client.channels.fetch(customer.channel_id).catch(() => null);
    if (discordChannel && customer.discord_user_id) {
      await discordChannel.permissionOverwrites.delete(customer.discord_user_id).catch(() => {});
    }

    await interaction.editReply({
      embeds: [
        infoEmbed({
          title: "🔒 Revoked",
          description:
            `**${customer.name}** has been fully revoked — polling stopped, channel access removed` +
            (reason ? `.\nReason: ${reason}` : "."),
          color: 0xed4245,
        }),
      ],
    });
  },
};
