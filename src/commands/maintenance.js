const { SlashCommandBuilder } = require("discord.js");
const db = require("../db");
const { isAdmin } = require("../authz");
const { infoEmbed } = require("../embeds");
const runtimeSettings = require("../runtimeSettings");

const listActivatedCustomers = db.prepare("SELECT * FROM customers WHERE activated = 1");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("maintenance")
    .setDescription("[admin] Globally pause or resume all polling, with an announcement to every client")
    .addStringOption((opt) =>
      opt
        .setName("mode")
        .setDescription("on or off")
        .setRequired(true)
        .addChoices({ name: "on", value: "on" }, { name: "off", value: "off" })
    )
    .addStringOption((opt) => opt.setName("reason").setDescription("Why (shown to clients when turning on)").setRequired(false)),

  async execute(interaction) {
    if (!isAdmin(interaction.user.id)) {
      return interaction.reply({ embeds: [infoEmbed({ title: "Not authorized", color: 0xed4245 })], ephemeral: true });
    }

    const mode = interaction.options.getString("mode", true);
    const reason = interaction.options.getString("reason", false);
    const enabling = mode === "on";

    if (enabling === runtimeSettings.get().maintenanceMode) {
      return interaction.reply({
        embeds: [infoEmbed({ title: enabling ? "Already on" : "Already off" })],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });
    runtimeSettings.setMaintenance(enabling, reason);

    const announcement = enabling
      ? infoEmbed({
          title: "🔧 Maintenance",
          description: `Sentinel review is temporarily paused${reason ? `: ${reason}` : "."}\nNo new proposals will post until this is lifted.`,
          color: 0xf5a623,
        })
      : infoEmbed({ title: "🟢 Maintenance complete", description: "Sentinel review is back — polling has resumed.", color: 0x2ecc71 });

    const customers = listActivatedCustomers.all();
    let notified = 0;
    for (const customer of customers) {
      try {
        const channel = await interaction.client.channels.fetch(customer.channel_id);
        await channel.send({ embeds: [announcement] });
        notified += 1;
      } catch {
        // best-effort — the summary reply below still confirms the mode change either way
      }
    }

    await interaction.editReply({
      embeds: [
        infoEmbed({
          title: enabling ? "Maintenance mode ON" : "Maintenance mode OFF",
          description: `Notified ${notified}/${customers.length} client channel(s).`,
          color: enabling ? 0xf5a623 : 0x2ecc71,
        }),
      ],
    });
  },
};
