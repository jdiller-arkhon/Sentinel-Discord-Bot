const { SlashCommandBuilder } = require("discord.js");
const db = require("../db");
const { checkAdmin } = require("../authz");
const { infoEmbed } = require("../embeds");

const listActivatedCustomers = db.prepare("SELECT * FROM customers WHERE activated = 1");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("broadcast")
    .setDescription("[admin] Send an announcement to every activated client's channel")
    .addStringOption((opt) => opt.setName("message").setDescription("The announcement text").setRequired(true)),

  async execute(interaction) {
    if (!checkAdmin(interaction, "broadcast")) {
      return interaction.reply({ embeds: [infoEmbed({ title: "Not authorized", color: 0xed4245 })], ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const message = interaction.options.getString("message", true);
    const customers = listActivatedCustomers.all();
    const embed = infoEmbed({ title: "📣 Announcement", description: message, color: 0x5865f2 });

    let sent = 0;
    const failures = [];
    for (const customer of customers) {
      try {
        const channel = await interaction.client.channels.fetch(customer.channel_id);
        await channel.send({ embeds: [embed] });
        sent += 1;
      } catch (err) {
        failures.push(customer.name);
      }
    }

    await interaction.editReply({
      embeds: [
        infoEmbed({
          title: "Broadcast sent",
          description:
            `Delivered to ${sent}/${customers.length} client channel(s).` +
            (failures.length ? `\nFailed: ${failures.join(", ")}` : ""),
          color: failures.length ? 0xf5a623 : 0x2ecc71,
        }),
      ],
    });
  },
};
