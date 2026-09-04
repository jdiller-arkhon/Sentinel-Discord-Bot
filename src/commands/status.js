const { SlashCommandBuilder } = require("discord.js");
const db = require("../db");

const getByChannel = db.prepare("SELECT * FROM customers WHERE channel_id = ?");

module.exports = {
  data: new SlashCommandBuilder().setName("status").setDescription("Check this channel's connection to Sentinel"),

  async execute(interaction) {
    const customer = getByChannel.get(interaction.channelId);
    if (!customer) {
      return interaction.reply({
        content: "This channel isn't linked to a Sentinel instance.",
        ephemeral: true,
      });
    }

    const lines = [
      `**${customer.name}**`,
      `Active: ${customer.active ? "yes" : "no (paused)"}`,
      `Sentinel URL: \`${customer.sentinel_base_url}\``,
      `Last poll: ${customer.last_poll_at ? new Date(customer.last_poll_at).toLocaleString() : "never yet"}`,
      `Last poll result: ${customer.last_poll_at ? (customer.last_poll_ok ? "ok" : "failed") : "n/a"}`,
    ];
    if (customer.consecutive_failures > 0) {
      lines.push(`Consecutive failures: ${customer.consecutive_failures}`);
      if (customer.last_error) lines.push(`Last error: \`${customer.last_error}\``);
    }

    await interaction.reply({ content: lines.join("\n"), ephemeral: true });
  },
};
