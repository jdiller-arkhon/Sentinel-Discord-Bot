const { SlashCommandBuilder } = require("discord.js");
const db = require("../db");
const { isOwnerOrAdmin } = require("../authz");

const getByChannel = db.prepare("SELECT * FROM customers WHERE channel_id = ?");
const setActive = db.prepare("UPDATE customers SET active = ? WHERE id = ?");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pause")
    .setDescription("Stop polling Sentinel for this channel until /resume"),

  async execute(interaction) {
    const customer = getByChannel.get(interaction.channelId);
    if (!customer) {
      return interaction.reply({ content: "This channel isn't linked to a Sentinel instance.", ephemeral: true });
    }
    if (!isOwnerOrAdmin(customer, interaction.user.id)) {
      return interaction.reply({ content: "Only the client this channel belongs to can do that.", ephemeral: true });
    }
    if (!customer.active) {
      return interaction.reply({ content: "Already paused.", ephemeral: true });
    }

    setActive.run(0, customer.id);
    await interaction.reply({
      content: "Paused. No new proposals will be posted here until you run `/resume`. Already-posted ones can still be approved/rejected.",
      ephemeral: true,
    });
  },
};
