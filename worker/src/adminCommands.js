import { createLicense, getLicense, activateLicense, getLicenseByChannelId, listLicenses, revokeLicense } from './db.js';
import { createPrivateChannel, denyChannelAccess, postChannelMessage } from './discordApi.js';
import { isValidSentinelUrl, isValidLicenseKeyFormat } from './validators.js';

export const licenseCommandDefinition = {
  name: 'license',
  description: 'Manage customer licenses (admin only)',
  default_member_permissions: String(1 << 3), // ADMINISTRATOR
  options: [
    {
      name: 'create',
      description: 'Generate a new activation token for a customer',
      type: 1, // SUB_COMMAND
      options: [{ name: 'customer_name', description: 'Customer name', type: 3, required: true }],
    },
    {
      name: 'revoke',
      description: "Revoke a customer's access",
      type: 1,
      options: [{ name: 'key', description: 'License key, e.g. SENT-XXXX-XXXX-XXXX-XXXX', type: 3, required: true }],
    },
    { name: 'list', description: 'List all customer licenses', type: 1 },
  ],
};

export const activateCommandDefinition = {
  name: 'activate',
  description: 'Redeem your Sentinel activation token and set up your private channel',
  options: [
    { name: 'token', description: 'The activation token you were given, e.g. SENT-XXXX-XXXX-XXXX-XXXX', type: 3, required: true },
    { name: 'sentinel_url', description: 'Your Sentinel tunnel URL, e.g. https://sentinel.example.com', type: 3, required: true },
    {
      name: 'sentinel_token',
      description: 'Your X-Sentinel-Token shared secret, if you set one up in Sentinel (optional but recommended)',
      type: 3,
      required: false,
    },
  ],
};

function ephemeral(content) {
  return { type: 4, data: { content, flags: 1 << 6 } };
}

function getOption(interaction, name) {
  return interaction.data.options?.find((o) => o.name === name)?.value?.trim();
}

function mask(url) {
  return url ? url.replace(/^https:\/\//, '') : '(not activated)';
}

export async function handleLicenseCommand(interaction, env) {
  const sub = interaction.data.options[0];

  if (sub.name === 'create') {
    const customerName = sub.options.find((o) => o.name === 'customer_name').value.trim();
    const licenseKey = await createLicense(env.DB, customerName);
    return ephemeral(
      `License created for **${customerName}**: \`${licenseKey}\`\n\n` +
        `Give this token to the customer. Once they've joined this server, they redeem it with:\n` +
        `\`/activate token:${licenseKey} sentinel_url:<their tunnel URL>\``,
    );
  }

  if (sub.name === 'revoke') {
    const key = sub.options.find((o) => o.name === 'key').value.trim();
    const license = await getLicense(env.DB, key);
    if (!license || license.license_key === 'ADMIN') {
      return ephemeral(`No license found with key \`${key}\`.`);
    }
    await revokeLicense(env.DB, key);
    if (license.discord_channel_id && license.discord_allowed_user_id) {
      try {
        await denyChannelAccess(env.ADMIN_BOT_TOKEN, license.discord_channel_id, license.discord_allowed_user_id);
        await postChannelMessage(env.ADMIN_BOT_TOKEN, license.discord_channel_id, {
          content: '🔴 This license has been revoked. This channel is now read-only for you and will no longer receive proposals.',
        });
      } catch (err) {
        return ephemeral(`Revoked \`${key}\`, but failed to lock the channel: ${err.message}`);
      }
    }
    return ephemeral(`Revoked license \`${key}\` (${license.customer_name}).`);
  }

  if (sub.name === 'list') {
    const licenses = await listLicenses(env.DB);
    if (licenses.length === 0) return ephemeral('No customer licenses yet. Use `/license create`.');
    const lines = licenses.map((l) => {
      const status = l.revoked ? '🔴 revoked' : l.activated ? '🟢 active' : '🟡 pending activation';
      return `${status}  \`${l.license_key}\` — ${l.customer_name}${l.activated ? ` (channel <#${l.discord_channel_id}>, sentinel ${mask(l.sentinel_base_url)})` : ''}`;
    });
    return ephemeral(lines.join('\n'));
  }

  return ephemeral('Unknown subcommand.');
}

export async function handleActivateCommand(interaction, env) {
  const token = getOption(interaction, 'token');
  const sentinelUrl = getOption(interaction, 'sentinel_url');
  const sentinelToken = getOption(interaction, 'sentinel_token');
  const invokerId = interaction.member?.user?.id ?? interaction.user?.id;
  const guildId = interaction.guild_id;

  if (!guildId) {
    return ephemeral('Run `/activate` inside the server, not in a DM — I need to create your private channel here.');
  }

  if (!isValidLicenseKeyFormat(token)) {
    return ephemeral('That doesn\'t look like a valid token (expected format `SENT-XXXX-XXXX-XXXX-XXXX`). Double-check what you were given.');
  }
  if (!isValidSentinelUrl(sentinelUrl)) {
    return ephemeral('`sentinel_url` should start with `https://` — a Cloudflare Tunnel / ngrok URL, not `http://127.0.0.1:...`.');
  }

  const license = await getLicense(env.DB, token);
  if (!license || license.license_key === 'ADMIN') {
    return ephemeral('That token was not recognized. Double-check it, or contact whoever gave it to you.');
  }
  if (license.revoked) {
    return ephemeral('That token has been revoked.');
  }
  if (license.activated) {
    if (license.discord_allowed_user_id !== invokerId) {
      return ephemeral(`That token was already activated by someone else — see <#${license.discord_channel_id}>.`);
    }
    // Let the original activator update their Sentinel URL/token in place, without
    // creating a second channel.
    await activateLicense(env.DB, token, {
      channelId: license.discord_channel_id,
      allowedUserId: invokerId,
      sentinelBaseUrl: sentinelUrl,
      sentinelToken,
    });
    return ephemeral(`Updated your Sentinel connection details for <#${license.discord_channel_id}>.`);
  }

  const channel = await createPrivateChannel(env.ADMIN_BOT_TOKEN, {
    guildId,
    botUserId: env.ADMIN_BOT_USER_ID,
    userId: invokerId,
    name: `sentinel-${license.customer_name}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 90),
    parentId: env.ADMIN_CUSTOMER_CATEGORY_ID || undefined,
  });

  await activateLicense(env.DB, token, { channelId: channel.id, allowedUserId: invokerId, sentinelBaseUrl: sentinelUrl, sentinelToken });

  await postChannelMessage(env.ADMIN_BOT_TOKEN, channel.id, {
    content:
      `👋 This is **${license.customer_name}**'s private Sentinel channel. Only you and this bot can see it.\n` +
      `Pending AI strategy proposals from your Sentinel instance will post here with Approve/Reject buttons — ` +
      `only <@${invokerId}> can click them.` +
      (sentinelToken ? '' : '\n\n⚠️ No shared-secret token was set — anyone who discovers your Sentinel tunnel URL could call it directly. Consider enabling one in Sentinel\'s settings and re-running `/activate`.'),
  });

  return ephemeral(`Activated! Your private channel is ready: <#${channel.id}>`);
}
