const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const crypto = require("crypto");
const db = require("../db");
const config = require("../config");
const { generateActivationCode } = require("../activation");
const { infoEmbed } = require("../embeds");
const secretCrypto = require("../secretCrypto");

const insertCustomer = db.prepare(`
  INSERT INTO customers (
    id, name, discord_user_id, channel_id, sentinel_base_url, sentinel_token,
    active, activated, activation_code_hash, activation_code_expires_at, created_at
  )
  VALUES (
    @id, @name, @discordUserId, @channelId, @sentinelBaseUrl, @sentinelToken,
    1, @activated, @activationCodeHash, @activationCodeExpiresAt, @createdAt
  )
`);

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "client";
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("onboard")
    .setDescription("[admin] Provision a private channel for a new Sentinel client")
    .addStringOption((opt) => opt.setName("name").setDescription("Client/company name").setRequired(true))
    .addUserOption((opt) =>
      opt
        .setName("client")
        .setDescription("The client's Discord account, if already known — skips /activate")
        .setRequired(false)
    )
    .addStringOption((opt) => opt.setName("sentinel_url").setDescription("Their Sentinel base URL").setRequired(true))
    .addStringOption((opt) => opt.setName("sentinel_token").setDescription("Their X-Sentinel-Token (if configured)").setRequired(false)),

  async execute(interaction) {
    if (!config.adminUserIds.has(interaction.user.id)) {
      return interaction.reply({
        embeds: [infoEmbed({ title: "Not authorized", description: "You're not authorized to run this.", color: 0xed4245 })],
        ephemeral: true,
      });
    }

    const guild = interaction.guild;
    if (guild.channels.cache.size >= config.maxChannelsPerGuild) {
      return interaction.reply({
        embeds: [
          infoEmbed({
            title: "Channel limit reached",
            description:
              `This server has ${guild.channels.cache.size} channels, at or past the configured safety ceiling ` +
              `(${config.maxChannelsPerGuild}, below Discord's hard ~500 limit). Refusing to create another — ` +
              "archive/delete old client channels or raise maxChannelsPerGuild deliberately.",
            color: 0xed4245,
          }),
        ],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const client = interaction.options.getUser("client", false);
    const name = interaction.options.getString("name", true);
    const sentinelUrl = interaction.options.getString("sentinel_url", true);
    const sentinelToken = interaction.options.getString("sentinel_token", false);

    const customerId = crypto.randomUUID();
    // Suffix with the customer id's first 8 chars so two clients with the
    // same/similar name can never collide on channel name. The 🛡️ prefix
    // is a standard Unicode emoji, not the Sentinel logo image — Discord
    // channel names can only render Unicode emoji, never a custom
    // uploaded server emoji (that shows as literal ":sentinel:" text
    // there, even though it works fine in messages/reactions).
    const channelName = `🛡️-client-${slugify(name)}-${customerId.slice(0, 8)}`;
    const botMemberId = interaction.client.user.id;

    if (client) {
      // Known Discord account — activate immediately, same as before.
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
            id: botMemberId,
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
        sentinelToken: sentinelToken ? secretCrypto.encrypt(sentinelToken) : null,
        activated: 1,
        activationCodeHash: null,
        activationCodeExpiresAt: null,
        createdAt: new Date().toISOString(),
      });

      await channel.send({
        content: `<@${client.id}>`,
        embeds: [
          infoEmbed({
            title: "👋 Welcome to Sentinel",
            description:
              "This is your private review channel. New AI strategy proposals will show up here with Approve/Reject buttons as they come in.\n\n" +
              "Run `/status` any time to check the connection, or `/help` for more.",
            color: 0x2ecc71,
          }),
        ],
      });

      return interaction.editReply({
        embeds: [infoEmbed({ title: "Client onboarded", description: `Created ${channel} for **${name}**.`, fields: [{ name: "Customer ID", value: `\`${customerId}\`` }], color: 0x2ecc71 })],
      });
    }

    // No Discord account known yet — self-serve path. Channel is locked
    // to admins/the bot only; a one-time, high-entropy code (never
    // stored in plaintext) is handed to whoever purchased access, and
    // /activate claims the channel once, with rate limiting.
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: botMemberId,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        },
      ],
    });

    const { code, hash, expiresAt } = generateActivationCode();

    insertCustomer.run({
      id: customerId,
      name,
      discordUserId: null,
      channelId: channel.id,
      sentinelBaseUrl: sentinelUrl,
      sentinelToken: sentinelToken ? secretCrypto.encrypt(sentinelToken) : null,
      activated: 0,
      activationCodeHash: hash,
      activationCodeExpiresAt: expiresAt,
      createdAt: new Date().toISOString(),
    });

    await interaction.editReply({
      embeds: [
        infoEmbed({
          title: "Client onboarded — pending activation",
          description:
            `Created ${channel} for **${name}**, locked until claimed.\n\n` +
            `Give the client this code to claim it — have them join this server and run ` +
            `\`/activate code:${code}\` in any channel they can see (the code, not channel access, is what protects the claim).\n\n` +
            "⚠️ **This code is shown once and is not recoverable — copy it now.**",
          fields: [
            { name: "Customer ID", value: `\`${customerId}\``, inline: true },
            { name: "Code expires", value: new Date(expiresAt).toLocaleDateString(), inline: true },
          ],
          color: 0xf5a623,
        }),
      ],
    });
  },
};
