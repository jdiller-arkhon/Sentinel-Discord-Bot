import { createLicense, createPendingCreate, consumePendingCreate, listLicenses, revokeLicense } from './db.js';

export const licenseCommandDefinition = {
  name: 'license',
  description: 'Manage sub-bot licenses for Sentinel customers',
  default_member_permissions: String(1 << 3), // ADMINISTRATOR
  options: [
    {
      name: 'create',
      description: "Create a new customer license (bot token collected via a follow-up form)",
      type: 1, // SUB_COMMAND
      options: [
        { name: 'customer_name', description: 'Customer name', type: 3, required: true },
        { name: 'application_id', description: "Customer's Discord Application id", type: 3, required: true },
        { name: 'public_key', description: "Customer's Discord Application public key", type: 3, required: true },
        { name: 'channel_id', description: 'Discord channel id proposals get posted in', type: 3, required: true },
        { name: 'allowed_user_id', description: 'Discord user id allowed to approve/reject', type: 3, required: true },
        { name: 'sentinel_base_url', description: "Customer's Sentinel URL (tunnel), e.g. https://sentinel.example.com", type: 3, required: true },
      ],
    },
    {
      name: 'revoke',
      description: 'Revoke a customer license',
      type: 1,
      options: [{ name: 'key', description: 'License key, e.g. SENT-XXXX-XXXX-XXXX-XXXX', type: 3, required: true }],
    },
    { name: 'list', description: 'List all customer licenses', type: 1 },
  ],
};

function mask(token) {
  if (!token) return '';
  return token.length <= 8 ? '****' : `${token.slice(0, 4)}...${token.slice(-4)}`;
}

function getOption(interaction, name) {
  const sub = interaction.data.options[0];
  return sub.options?.find((o) => o.name === name)?.value;
}

function ephemeral(content) {
  return { type: 4, data: { content, flags: 1 << 6 } };
}

function modal(customId, title, fields) {
  return {
    type: 9,
    data: {
      custom_id: customId,
      title,
      components: fields.map((f) => ({
        type: 1,
        components: [{ type: 4, custom_id: f.id, label: f.label, style: 1, required: true }],
      })),
    },
  };
}

export async function handleLicenseCommand(interaction, env) {
  const sub = interaction.data.options[0].name;

  if (sub === 'create') {
    const record = {
      customerName: getOption(interaction, 'customer_name'),
      discordApplicationId: getOption(interaction, 'application_id'),
      discordPublicKey: getOption(interaction, 'public_key'),
      discordChannelId: getOption(interaction, 'channel_id'),
      discordAllowedUserId: getOption(interaction, 'allowed_user_id'),
      sentinelBaseUrl: getOption(interaction, 'sentinel_base_url'),
    };
    const pendingId = await createPendingCreate(env.DB, record);
    return modal(`license-create:${pendingId}`, `License for ${record.customerName}`, [
      { id: 'discordBotToken', label: "Customer's Discord bot token" },
    ]);
  }

  if (sub === 'revoke') {
    const key = getOption(interaction, 'key');
    const revoked = await revokeLicense(env.DB, key);
    return ephemeral(
      revoked ? `Revoked license \`${key}\`. It will stop within a minute (next cron pass).` : `No license found with key \`${key}\`.`,
    );
  }

  if (sub === 'list') {
    const licenses = await listLicenses(env.DB);
    const customerLicenses = licenses.filter((l) => !l.is_admin);
    if (customerLicenses.length === 0) {
      return ephemeral('No customer licenses yet. Use `/license create`.');
    }
    const lines = customerLicenses.map(
      (l) =>
        `${l.revoked ? '🔴' : '🟢'} \`${l.license_key}\` — ${l.customer_name} (channel ${l.discord_channel_id}, user ${l.discord_allowed_user_id}, token ${mask(l.discord_bot_token)})`,
    );
    return ephemeral(lines.join('\n'));
  }

  return ephemeral('Unknown subcommand.');
}

export async function handleLicenseCreateModalSubmit(interaction, env) {
  const pendingId = interaction.data.custom_id.split(':')[1];
  const pending = await consumePendingCreate(env.DB, pendingId);
  if (!pending) {
    return ephemeral('This form expired or was already submitted. Run `/license create` again.');
  }

  const discordBotToken = interaction.data.components[0].components[0].value.trim();

  const { licenseKey } = await createLicense(env.DB, {
    customerName: pending.customer_name,
    discordApplicationId: pending.discord_application_id,
    discordPublicKey: pending.discord_public_key,
    discordBotToken,
    discordChannelId: pending.discord_channel_id,
    discordAllowedUserId: pending.discord_allowed_user_id,
    sentinelBaseUrl: pending.sentinel_base_url,
  });

  return ephemeral(
    `License created for **${pending.customer_name}**: \`${licenseKey}\`\n` +
      `Their bot will start posting proposals within a minute (next cron pass), as long as their ` +
      `Discord Application's Interactions Endpoint URL is set to this Worker's \`/interactions\` URL.`,
  );
}
