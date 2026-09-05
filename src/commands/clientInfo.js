const { SlashCommandBuilder, ChannelType } = require("discord.js");
const db = require("../db");
const { checkAdmin } = require("../authz");
const { infoEmbed } = require("../embeds");

const getByChannel = db.prepare("SELECT * FROM customers WHERE channel_id = ?");
const countAudit = db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE customer_id = ?");
const countPosted = db.prepare("SELECT COUNT(*) AS n FROM posted_proposals WHERE customer_id = ?");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("client-info")
    .setDescription("[admin] Deep-dive on one client's configuration and history")
    .addChannelOption((opt) =>
      opt.setName("channel").setDescription("The client's channel").addChannelTypes(ChannelType.GuildText).setRequired(true)
    ),

  async execute(interaction) {
    if (!checkAdmin(interaction, "client-info")) {
      return interaction.reply({ embeds: [infoEmbed({ title: "Not authorized", color: 0xed4245 })], ephemeral: true });
    }

    const channel = interaction.options.getChannel("channel", true);
    const customer = getByChannel.get(channel.id);
    if (!customer) {
      return interaction.reply({
        embeds: [infoEmbed({ title: "Not found", description: `${channel} isn't linked to a Sentinel instance.`, color: 0x8a8f98 })],
        ephemeral: true,
      });
    }

    const { n: auditCount } = countAudit.get(customer.id);
    const { n: postedCount } = countPosted.get(customer.id);

    const fields = [
      { name: "Channel", value: `${channel}`, inline: true },
      { name: "Discord user", value: customer.discord_user_id ? `<@${customer.discord_user_id}>` : "_(unclaimed)_", inline: true },
      { name: "Customer ID", value: `\`${customer.id}\``, inline: true },
      { name: "Sentinel URL", value: `\`${customer.sentinel_base_url}\`` },
      { name: "Token configured", value: customer.sentinel_token ? "✅ yes" : "❌ no", inline: true },
      { name: "Activated", value: customer.activated ? "✅ yes" : "🔒 pending", inline: true },
      { name: "Active", value: customer.active ? "🟢 yes" : "⏸️ paused", inline: true },
      { name: "Consecutive failures", value: `${customer.consecutive_failures}`, inline: true },
      {
        name: "Last poll",
        value: customer.last_poll_at ? `${new Date(customer.last_poll_at).toLocaleString()} (${customer.last_poll_ok ? "ok" : "failed"})` : "never",
        inline: true,
      },
      { name: "Proposals posted", value: `${postedCount}`, inline: true },
      { name: "Audit entries", value: `${auditCount}`, inline: true },
      { name: "Created", value: new Date(customer.created_at).toLocaleString(), inline: true },
    ];
    if (customer.last_error) fields.push({ name: "Last error", value: `\`${customer.last_error}\`` });
    if (!customer.activated && customer.activation_code_expires_at) {
      fields.push({ name: "Activation code expires", value: new Date(customer.activation_code_expires_at).toLocaleString() });
    }

    await interaction.reply({ embeds: [infoEmbed({ title: customer.name, fields })], ephemeral: true });
  },
};
