const { SlashCommandBuilder } = require("discord.js");
const db = require("../db");
const { isAdmin } = require("../authz");

const listAll = db.prepare("SELECT * FROM customers ORDER BY created_at DESC");

module.exports = {
  data: new SlashCommandBuilder().setName("clients").setDescription("[admin] List all onboarded clients and their status"),

  async execute(interaction) {
    if (!isAdmin(interaction.user.id)) {
      return interaction.reply({ content: "You're not authorized to run this.", ephemeral: true });
    }

    const rows = listAll.all();
    if (rows.length === 0) {
      return interaction.reply({ content: "No clients onboarded yet.", ephemeral: true });
    }

    const lines = rows.map((c) => {
      const state = !c.activated
        ? "pending activation"
        : !c.active
        ? "paused"
        : c.consecutive_failures > 0
        ? `${c.consecutive_failures} failures`
        : "ok";
      return `**${c.name}** — <#${c.channel_id}> — ${state}`;
    });

    // Keep well under Discord's 2000-char message limit even with a large roster.
    const content = lines.join("\n").slice(0, 1900);
    await interaction.reply({ content, ephemeral: true });
  },
};
