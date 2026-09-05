const { SlashCommandBuilder } = require("discord.js");
const { isAdmin } = require("../authz");
const { infoEmbed } = require("../embeds");
const runtimeSettings = require("../runtimeSettings");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("settings")
    .setDescription("[admin] View or change bot-wide settings, effective immediately, no restart")
    .addIntegerOption((opt) =>
      opt.setName("poll_interval_seconds").setDescription("How often to poll each client for new proposals").setRequired(false)
    )
    .addIntegerOption((opt) =>
      opt.setName("failure_threshold").setDescription("Consecutive failures before an admin alert").setRequired(false)
    ),

  async execute(interaction) {
    if (!isAdmin(interaction.user.id)) {
      return interaction.reply({ embeds: [infoEmbed({ title: "Not authorized", color: 0xed4245 })], ephemeral: true });
    }

    const pollIntervalSeconds = interaction.options.getInteger("poll_interval_seconds", false);
    const failureThreshold = interaction.options.getInteger("failure_threshold", false);

    if (pollIntervalSeconds !== null) {
      if (pollIntervalSeconds < 10) {
        return interaction.reply({
          embeds: [infoEmbed({ title: "Too low", description: "Minimum poll interval is 10 seconds.", color: 0xed4245 })],
          ephemeral: true,
        });
      }
      runtimeSettings.setPollIntervalMs(pollIntervalSeconds * 1000);
    }
    if (failureThreshold !== null) {
      if (failureThreshold < 1) {
        return interaction.reply({
          embeds: [infoEmbed({ title: "Too low", description: "Failure threshold must be at least 1.", color: 0xed4245 })],
          ephemeral: true,
        });
      }
      runtimeSettings.setFailureAlertThreshold(failureThreshold);
    }

    const current = runtimeSettings.get();
    await interaction.reply({
      embeds: [
        infoEmbed({
          title: "Bot settings",
          fields: [
            { name: "Poll interval", value: `${current.pollIntervalMs / 1000}s`, inline: true },
            { name: "Failure alert threshold", value: `${current.failureAlertThreshold}`, inline: true },
            { name: "Maintenance mode", value: current.maintenanceMode ? `🔧 on (${current.maintenanceReason || "no reason given"})` : "off", inline: true },
          ],
        }),
      ],
      ephemeral: true,
    });
  },
};
