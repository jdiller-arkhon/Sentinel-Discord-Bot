const { SlashCommandBuilder, ChannelType } = require("discord.js");
const db = require("../db");
const { isAdmin } = require("../authz");
const { infoEmbed } = require("../embeds");

const getByChannel = db.prepare("SELECT * FROM customers WHERE channel_id = ?");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("update-client")
    .setDescription("[admin] Change a client's name, Sentinel URL, or token without re-onboarding")
    .addChannelOption((opt) =>
      opt.setName("channel").setDescription("The client's channel").addChannelTypes(ChannelType.GuildText).setRequired(true)
    )
    .addStringOption((opt) => opt.setName("name").setDescription("New client/company name").setRequired(false))
    .addStringOption((opt) => opt.setName("sentinel_url").setDescription("New Sentinel base URL").setRequired(false))
    .addStringOption((opt) => opt.setName("sentinel_token").setDescription("New X-Sentinel-Token").setRequired(false)),

  async execute(interaction) {
    if (!isAdmin(interaction.user.id)) {
      return interaction.reply({ embeds: [infoEmbed({ title: "Not authorized", color: 0xed4245 })], ephemeral: true });
    }

    const channel = interaction.options.getChannel("channel", true);
    const name = interaction.options.getString("name", false);
    const sentinelUrl = interaction.options.getString("sentinel_url", false);
    const sentinelToken = interaction.options.getString("sentinel_token", false);

    const customer = getByChannel.get(channel.id);
    if (!customer) {
      return interaction.reply({
        embeds: [infoEmbed({ title: "Not found", description: `${channel} isn't linked to a Sentinel instance.`, color: 0x8a8f98 })],
        ephemeral: true,
      });
    }
    if (!name && !sentinelUrl && !sentinelToken) {
      return interaction.reply({
        embeds: [infoEmbed({ title: "Nothing to update", description: "Pass at least one of name/sentinel_url/sentinel_token.", color: 0x8a8f98 })],
        ephemeral: true,
      });
    }

    const updates = [];
    if (name) {
      db.prepare("UPDATE customers SET name = ? WHERE id = ?").run(name, customer.id);
      updates.push(`name → **${name}**`);
    }
    if (sentinelUrl) {
      db.prepare("UPDATE customers SET sentinel_base_url = ? WHERE id = ?").run(sentinelUrl, customer.id);
      updates.push(`Sentinel URL → \`${sentinelUrl}\``);
    }
    if (sentinelToken) {
      db.prepare("UPDATE customers SET sentinel_token = ? WHERE id = ?").run(sentinelToken, customer.id);
      updates.push("Sentinel token → _(updated, not shown)_");
    }

    await interaction.reply({
      embeds: [infoEmbed({ title: "Client updated", description: updates.join("\n"), color: 0x2ecc71 })],
      ephemeral: true,
    });
  },
};
