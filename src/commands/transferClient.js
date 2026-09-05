const { SlashCommandBuilder, ChannelType } = require("discord.js");
const db = require("../db");
const { checkAdmin } = require("../authz");
const { infoEmbed } = require("../embeds");
const securityLog = require("../securityLog");

const getByChannel = db.prepare("SELECT * FROM customers WHERE channel_id = ?");
const transferStmt = db.prepare("UPDATE customers SET discord_user_id = ? WHERE id = ?");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("transfer-client")
    .setDescription("[admin] Move a client's channel to a different Discord account (they changed accounts)")
    .addChannelOption((opt) =>
      opt.setName("channel").setDescription("The client's channel").addChannelTypes(ChannelType.GuildText).setRequired(true)
    )
    .addUserOption((opt) => opt.setName("new_owner").setDescription("Their new Discord account").setRequired(true)),

  async execute(interaction) {
    if (!checkAdmin(interaction, "transfer-client")) {
      return interaction.reply({ embeds: [infoEmbed({ title: "Not authorized", color: 0xed4245 })], ephemeral: true });
    }

    const channel = interaction.options.getChannel("channel", true);
    const newOwner = interaction.options.getUser("new_owner", true);
    const customer = getByChannel.get(channel.id);
    if (!customer) {
      return interaction.reply({
        embeds: [infoEmbed({ title: "Not found", description: `${channel} isn't linked to a Sentinel instance.`, color: 0x8a8f98 })],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const discordChannel = await interaction.client.channels.fetch(customer.channel_id).catch(() => null);
    if (discordChannel) {
      if (customer.discord_user_id) {
        await discordChannel.permissionOverwrites.delete(customer.discord_user_id).catch(() => {});
      }
      await discordChannel.permissionOverwrites.edit(newOwner.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });
    }

    transferStmt.run(newOwner.id, customer.id);
    securityLog.record("client_transferred", {
      discordUserId: interaction.user.id,
      discordUsername: interaction.user.tag,
      detail: `${customer.name} (${customer.id}) → <@${newOwner.id}> (${newOwner.id})`,
    });

    await interaction.editReply({
      embeds: [
        infoEmbed({
          title: "Client transferred",
          description: `**${customer.name}** (${channel}) now belongs to <@${newOwner.id}>.`,
          color: 0x2ecc71,
        }),
      ],
    });
  },
};
