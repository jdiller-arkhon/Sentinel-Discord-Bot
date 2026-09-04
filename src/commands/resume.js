const { SlashCommandBuilder } = require("discord.js");
const db = require("../db");
const { isOwnerOrAdmin } = require("../authz");

const getByChannel = db.prepare("SELECT * FROM customers WHERE channel_id = ?");
const setActive = db.prepare("UPDATE customers SET active = ?, consecutive_failures = 0, alerted_failure = 0 WHERE id = ?");

module.exports = {
  data: new SlashCommandBuilder().setName("resume").setDescription("Resume polling Sentinel for this channel"),

  async execute(interaction) {
    const customer = getByChannel.get(interaction.channelId);
    if (!customer) {
      return interaction.reply({ content: "This channel isn't linked to a Sentinel instance.", ephemeral: true });
    }
    if (!isOwnerOrAdmin(customer, interaction.user.id)) {
      return interaction.reply({ content: "Only the client this channel belongs to can do that.", ephemeral: true });
    }
    if (customer.active) {
      return interaction.reply({ content: "Already active.", ephemeral: true });
    }

    // Resuming clears any stale failure streak so a pause->resume cycle
    // doesn't immediately re-trigger an admin alert from before the pause.
    setActive.run(1, customer.id);
    await interaction.reply({ content: "Resumed — polling again on the normal schedule.", ephemeral: true });
  },
};
