const { SlashCommandBuilder } = require("discord.js");
const db = require("../db");
const { isOwnerOrAdmin } = require("../authz");
const { infoEmbed } = require("../embeds");

const getByChannel = db.prepare("SELECT * FROM customers WHERE channel_id = ?");
const setActive = db.prepare("UPDATE customers SET active = ?, consecutive_failures = 0, alerted_failure = 0 WHERE id = ?");

module.exports = {
  data: new SlashCommandBuilder().setName("resume").setDescription("Resume polling Sentinel for this channel"),

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
    if (customer.active) {
      return interaction.reply({ embeds: [infoEmbed({ title: "Already active" })], ephemeral: true });
    }

    // Resuming clears any stale failure streak so a pause->resume cycle
    // doesn't immediately re-trigger an admin alert from before the pause.
    setActive.run(1, customer.id);
    await interaction.reply({
      embeds: [infoEmbed({ title: "🟢 Resumed", description: "Polling again on the normal schedule.", color: 0x2ecc71 })],
      ephemeral: true,
    });
  },
};
