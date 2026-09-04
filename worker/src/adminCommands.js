import { createLicense, createPendingCreate, consumePendingCreate, getLicenseByApplicationId, listLicenses, revokeLicense } from './db.js';
import { setInteractionsEndpointUrl, buildInviteUrl, editOriginalInteractionResponse } from './discordApi.js';
import { validationErrors, botTokenLooksValid } from './validators.js';

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
  return sub.options?.find((o) => o.name === name)?.value?.trim();
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

    // Fail fast on obviously malformed input instead of silently creating a
    // license that will never work — before we even ask for their bot token.
    const errors = validationErrors(record);
    if (errors.length > 0) {
      return ephemeral(`Fix these before continuing:\n${errors.map((e) => `• ${e}`).join('\n')}`);
    }

    const existing = await getLicenseByApplicationId(env.DB, record.discordApplicationId);
    if (existing) {
      return ephemeral(
        existing.revoked
          ? `That Discord Application already has a revoked license (\`${existing.license_key}\`, ${existing.customer_name}). Delete it in D1 first if you want to reuse the application.`
          : `That Discord Application is already licensed to **${existing.customer_name}** (\`${existing.license_key}\`).`,
      );
    }

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

// Deferred: setting the customer's Interactions Endpoint URL involves a real
// round-trip to Discord (which itself PINGs our /interactions endpoint as part
// of verifying it), so this runs after an immediate deferred-response ack
// (see index.js) rather than returning a value within Discord's 3s budget.
export async function finishLicenseCreate(interaction, env, workerOrigin) {
  const applicationId = interaction.application_id;
  const interactionToken = interaction.token;

  const respond = (content) => editOriginalInteractionResponse(applicationId, interactionToken, { content });

  const pendingId = interaction.data.custom_id.split(':')[1];
  const pending = await consumePendingCreate(env.DB, pendingId);
  if (!pending) {
    await respond('This form expired or was already submitted. Run `/license create` again.');
    return;
  }

  const discordBotToken = interaction.data.components[0].components[0].value.trim();
  if (!botTokenLooksValid(discordBotToken)) {
    await respond("That doesn't look like a real Discord bot token (should be three dot-separated segments). Run `/license create` again.");
    return;
  }

  const { licenseKey } = await createLicense(env.DB, {
    customerName: pending.customer_name,
    discordApplicationId: pending.discord_application_id,
    discordPublicKey: pending.discord_public_key,
    discordBotToken,
    discordChannelId: pending.discord_channel_id,
    discordAllowedUserId: pending.discord_allowed_user_id,
    sentinelBaseUrl: pending.sentinel_base_url,
  });

  const inviteUrl = buildInviteUrl(pending.discord_application_id);
  const interactionsUrl = `${workerOrigin}/interactions`;

  // Their license row now exists in D1, so our own /interactions handler can
  // already answer the verification PING Discord sends as part of this call —
  // meaning we can set their Interactions Endpoint URL for them right now,
  // instead of asking them to paste it into the Developer Portal themselves.
  let endpointStatus;
  try {
    await setInteractionsEndpointUrl(discordBotToken, interactionsUrl);
    endpointStatus = '✅ Interactions Endpoint URL set automatically — nothing to paste in the Developer Portal.';
  } catch (err) {
    endpointStatus =
      `⚠️ Could not set the Interactions Endpoint URL automatically (${err.message}). ` +
      `Set it manually in their app's General Information page to:\n\`${interactionsUrl}\``;
  }

  await respond(
    `**License created for ${pending.customer_name}:** \`${licenseKey}\`\n\n` +
      `${endpointStatus}\n\n` +
      `Remaining steps for the customer:\n` +
      `1. Invite the bot to their server: ${inviteUrl}\n` +
      `2. Make sure their Sentinel tunnel (\`${pending.sentinel_base_url}\`) is reachable.\n\n` +
      `Once both are done, proposals start posting within a minute (next cron pass).`,
  );
}
