const { SlashCommandBuilder, ChannelType } = require("discord.js");
const db = require("../db");
const { isAdmin } = require("../authz");
const { infoEmbed } = require("../embeds");
const { generateActivationCode } = require("../activation");

const getByChannel = db.prepare("SELECT * FROM customers WHERE channel_id = ?");
const relockStmt = db.prepare(`
  UPDATE customers
  SET activated = 0, discord_user_id = NULL, activation_code_hash = @hash, activation_code_expires_at = @expiresAt
  WHERE id = @id
`);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("regenerate-code")
    .setDescription("[admin] Re-lock a channel and issue a fresh activation code")
    .addChannelOption((opt) =>
      opt.setName("channel").setDescription("The client's channel").addChannelTypes(ChannelType.GuildText).setRequired(true)
    ),

  async execute(interaction) {
    if (!isAdmin(interaction.user.id)) {
      return interaction.reply({ embeds: [infoEmbed({ title: "Not authorized", color: 0xed4245 })], ephemeral: true });
    }

    const channel = interaction.options.getChannel("channel", true);
    const customer = getByChannel.get(channel.id);
    if (!customer) {
      return interaction.reply({
        embeds: [infoEmbed({ title: "Not found", description: `${channel} isn't linked to a Sentinel instance.`, color: 0x8a8f98 })],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    // Pull the previous owner's access, if any — the whole point of a
    // new code is that the old claim no longer applies.
    const discordChannel = await interaction.client.channels.fetch(customer.channel_id).catch(() => null);
    if (discordChannel && customer.discord_user_id) {
      await discordChannel.permissionOverwrites.delete(customer.discord_user_id).catch(() => {});
    }

    const { code, hash, expiresAt } = generateActivationCode();
    relockStmt.run({ id: customer.id, hash, expiresAt });

    await interaction.editReply({
      embeds: [
        infoEmbed({
          title: "New activation code issued",
          description:
            `${channel} is re-locked. Give the client this code to claim it: \`/activate code:${code}\`\n\n` +
            "⚠️ **This code is shown once and is not recoverable — copy it now.**",
          fields: [{ name: "Expires", value: new Date(expiresAt).toLocaleDateString() }],
          color: 0xf5a623,
        }),
      ],
    });
  },
};
