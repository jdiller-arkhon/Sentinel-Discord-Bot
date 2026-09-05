const { SlashCommandBuilder } = require("discord.js");
const db = require("../db");
const { infoEmbed } = require("../embeds");

const getByChannel = db.prepare("SELECT * FROM customers WHERE channel_id = ?");

module.exports = {
  data: new SlashCommandBuilder().setName("status").setDescription("Check this channel's connection to Sentinel"),

  async execute(interaction) {
    const customer = getByChannel.get(interaction.channelId);
    if (!customer) {
      return interaction.reply({
        embeds: [infoEmbed({ title: "Not linked", description: "This channel isn't linked to a Sentinel instance.", color: 0x8a8f98 })],
        ephemeral: true,
      });
    }

    const healthy = customer.active && (!customer.last_poll_at || customer.last_poll_ok);
    const fields = [
      { name: "Sentinel URL", value: `\`${customer.sentinel_base_url}\`` },
      { name: "State", value: customer.active ? "🟢 Active" : "⏸️ Paused", inline: true },
      {
        name: "Last poll",
        value: customer.last_poll_at ? new Date(customer.last_poll_at).toLocaleString() : "never yet",
        inline: true,
      },
      {
        name: "Last result",
        value: customer.last_poll_at ? (customer.last_poll_ok ? "✅ ok" : "❌ failed") : "—",
        inline: true,
      },
    ];
    if (customer.consecutive_failures > 0) {
      fields.push({ name: "Consecutive failures", value: `${customer.consecutive_failures}`, inline: true });
      if (customer.last_error) fields.push({ name: "Last error", value: `\`${customer.last_error}\`` });
    }

    await interaction.reply({
      embeds: [infoEmbed({ title: customer.name, fields, color: healthy ? 0x2ecc71 : 0xed4245 })],
      ephemeral: true,
    });
  },
};
