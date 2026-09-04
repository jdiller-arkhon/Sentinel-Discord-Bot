const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const crypto = require("crypto");
const db = require("../db");
const config = require("../config");

const insertCustomer = db.prepare(`
  INSERT INTO customers (id, name, discord_user_id, channel_id, sentinel_base_url, sentinel_token, active, created_at)
  VALUES (@id, @name, @discordUserId, @channelId, @sentinelBaseUrl, @sentinelToken, 1, @createdAt)
`);

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "client";
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("onboard")
    .setDescription("[admin] Provision a private channel for a new Sentinel client")
    .addUserOption((opt) => opt.setName("client").setDescription("The client's Discord account").setRequired(true))
    .addStringOption((opt) => opt.setName("name").setDescription("Client/company name").setRequired(true))
    .addStringOption((opt) => opt.setName("sentinel_url").setDescription("Their Sentinel base URL").setRequired(true))
    .addStringOption((opt) => opt.setName("sentinel_token").setDescription("Their X-Sentinel-Token (if configured)").setRequired(false)),

  async execute(interaction) {
    if (!config.adminUserIds.has(interaction.user.id)) {
      return interaction.reply({ content: "You're not authorized to run this.", ephemeral: true });
    }

    const guild = interaction.guild;
    if (guild.channels.cache.size >= config.maxChannelsPerGuild) {
      return interaction.reply({
        content:
          `This server has ${guild.channels.cache.size} channels, at or past the configured safety ceiling ` +
          `(${config.maxChannelsPerGuild}, below Discord's hard ~500 limit). Refusing to create another — ` +
          "archive/delete old client channels or raise maxChannelsPerGuild deliberately.",
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const client = interaction.options.getUser("client", true);
    const name = interaction.options.getString("name", true);
    const sentinelUrl = interaction.options.getString("sentinel_url", true);
    const sentinelToken = interaction.options.getString("sentinel_token", false);

    const customerId = crypto.randomUUID();
    // Suffix with the customer id's first 8 chars so two clients with the
    // same/similar name can never collide on channel name.
    const channelName = `client-${slugify(name)}-${customerId.slice(0, 8)}`;

    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: client.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        },
        {
          id: interaction.client.user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        },
      ],
    });

    insertCustomer.run({
      id: customerId,
      name,
      discordUserId: client.id,
      channelId: channel.id,
      sentinelBaseUrl: sentinelUrl,
      sentinelToken: sentinelToken || null,
      createdAt: new Date().toISOString(),
    });

    await channel.send(
      `Welcome, <@${client.id}>! This is your private Sentinel review channel. ` +
        "New AI strategy proposals will show up here with Approve/Reject buttons as they come in. " +
        "Run `/status` any time to check the connection, or `/help` for more."
    );

    await interaction.editReply(`Created ${channel} for **${name}** (customer id \`${customerId}\`).`);
  },
};
