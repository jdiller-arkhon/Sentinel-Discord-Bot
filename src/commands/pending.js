const { SlashCommandBuilder } = require("discord.js");
const db = require("../db");
const { isOwnerOrAdmin } = require("../authz");
const { pollCustomer } = require("../poller");

const getByChannel = db.prepare("SELECT * FROM customers WHERE channel_id = ?");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pending")
    .setDescription("Check Sentinel right now instead of waiting for the next scheduled poll"),

  async execute(interaction) {
    const customer = getByChannel.get(interaction.channelId);
    if (!customer) {
      return interaction.reply({ content: "This channel isn't linked to a Sentinel instance.", ephemeral: true });
    }
    if (!isOwnerOrAdmin(customer, interaction.user.id)) {
      return interaction.reply({ content: "Only the client this channel belongs to can do that.", ephemeral: true });
    }
    if (!customer.activated) {
      return interaction.reply({ content: "This channel hasn't been activated yet.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    const result = await pollCustomer(interaction.client, getByChannel.get(interaction.channelId));

    if (!result.ok) {
      return interaction.editReply(`Couldn't reach Sentinel: \`${result.error}\``);
    }
    if (result.postedCount === 0) {
      return interaction.editReply(
        result.pendingCount === 0
          ? "No pending proposals right now."
          : `${result.pendingCount} pending, but all already posted here.`
      );
    }
    await interaction.editReply(`Posted ${result.postedCount} new proposal(s) above.`);
  },
};
