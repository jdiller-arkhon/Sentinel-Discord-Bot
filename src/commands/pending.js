const { SlashCommandBuilder } = require("discord.js");
const db = require("../db");
const { isOwnerOrAdmin } = require("../authz");
const { pollCustomer } = require("../poller");
const { infoEmbed } = require("../embeds");

const getByChannel = db.prepare("SELECT * FROM customers WHERE channel_id = ?");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pending")
    .setDescription("Check Sentinel right now instead of waiting for the next scheduled poll"),

  async execute(interaction) {
    const customer = getByChannel.get(interaction.channelId);
    if (!customer) {
      return interaction.reply({
        embeds: [infoEmbed({ title: "Not linked", description: "This channel isn't linked to a Sentinel instance.", color: 0x8a8f98 })],
        ephemeral: true,
      });
    }
    if (!isOwnerOrAdmin(customer, interaction.user.id)) {
      return interaction.reply({
        embeds: [infoEmbed({ title: "Not authorized", description: "Only the client this channel belongs to can do that.", color: 0xed4245 })],
        ephemeral: true,
      });
    }
    if (!customer.activated) {
      return interaction.reply({
        embeds: [infoEmbed({ title: "Not yet activated", description: "This channel hasn't been activated yet.", color: 0x8a8f98 })],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });
    const result = await pollCustomer(interaction.client, getByChannel.get(interaction.channelId));

    if (!result.ok) {
      return interaction.editReply({
        embeds: [infoEmbed({ title: "Couldn't reach Sentinel", description: `\`${result.error}\``, color: 0xed4245 })],
      });
    }
    if (result.postedCount === 0) {
      return interaction.editReply({
        embeds: [
          infoEmbed({
            title: "Checked Sentinel",
            description:
              result.pendingCount === 0 ? "No pending proposals right now." : `${result.pendingCount} pending, but all already posted here.`,
          }),
        ],
      });
    }
    await interaction.editReply({
      embeds: [infoEmbed({ title: "Checked Sentinel", description: `Posted ${result.postedCount} new proposal(s) above. 👆`, color: 0x2ecc71 })],
    });
  },
};
