const { SlashCommandBuilder } = require("discord.js");
const db = require("../db");
const { isOwnerOrAdmin } = require("../authz");
const { infoEmbed } = require("../embeds");

const getByChannel = db.prepare("SELECT * FROM customers WHERE channel_id = ?");
const setActive = db.prepare("UPDATE customers SET active = ? WHERE id = ?");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pause")
    .setDescription("Stop polling Sentinel for this channel until /resume"),

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
    if (!customer.active) {
      return interaction.reply({ embeds: [infoEmbed({ title: "Already paused" })], ephemeral: true });
    }

    setActive.run(0, customer.id);
    await interaction.reply({
      embeds: [
        infoEmbed({
          title: "⏸️ Paused",
          description: "No new proposals will be posted here until you run `/resume`. Already-posted ones can still be approved/rejected.",
          color: 0xf5a623,
        }),
      ],
      ephemeral: true,
    });
  },
};
