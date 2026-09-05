const { SlashCommandBuilder } = require("discord.js");
const db = require("../db");
const { checkAdmin } = require("../authz");
const { infoEmbed } = require("../embeds");

const listAll = db.prepare("SELECT * FROM customers ORDER BY created_at DESC");

module.exports = {
  data: new SlashCommandBuilder().setName("clients").setDescription("[admin] List all onboarded clients and their status"),

  async execute(interaction) {
    if (!checkAdmin(interaction, "clients")) {
      return interaction.reply({
        embeds: [infoEmbed({ title: "Not authorized", description: "You're not authorized to run this.", color: 0xed4245 })],
        ephemeral: true,
      });
    }

    const rows = listAll.all();
    if (rows.length === 0) {
      return interaction.reply({ embeds: [infoEmbed({ title: "Clients", description: "No clients onboarded yet." })], ephemeral: true });
    }

    const lines = rows.map((c) => {
      const state = !c.activated
        ? "🔒 pending activation"
        : !c.active
        ? "⏸️ paused"
        : c.consecutive_failures > 0
        ? `⚠️ ${c.consecutive_failures} failures`
        : "🟢 ok";
      return `**${c.name}** — <#${c.channel_id}> — ${state}`;
    });

    // Keep well under Discord's 4096-char description limit even with a large roster.
    const description = lines.join("\n").slice(0, 4000);
    await interaction.reply({
      embeds: [infoEmbed({ title: `Clients (${rows.length})`, description })],
      ephemeral: true,
    });
  },
};
