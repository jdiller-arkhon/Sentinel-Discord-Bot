import { verifyDiscordRequest } from './verify.js';
import { getLicenseByChannelId, upsertAdminRow } from './db.js';
import { licenseCommandDefinition, activateCommandDefinition, handleLicenseCommand, handleActivateCommand } from './adminCommands.js';
import { resolveProposalAction } from './buttonHandler.js';
import { pollAllLicenses } from './poller.js';
import { registerCommands } from './discordApi.js';

const InteractionType = { PING: 1, APPLICATION_COMMAND: 2, MESSAGE_COMPONENT: 3 };

function json(body) {
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
}

async function ensureAdminRow(env) {
  await upsertAdminRow(env.DB, {
    channelId: env.ADMIN_CHANNEL_ID,
    allowedUserId: env.ADMIN_ALLOWED_USER_ID,
    sentinelBaseUrl: env.ADMIN_SENTINEL_BASE_URL,
  });
}

async function handleInteractions(request, env, ctx) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get('x-signature-ed25519');
  const timestampHeader = request.headers.get('x-signature-timestamp');

  // Only one Discord Application exists in this model (yours) — every request
  // is verified against the same public key, no per-customer lookup needed.
  const valid = await verifyDiscordRequest(rawBody, signatureHeader, timestampHeader, env.ADMIN_PUBLIC_KEY);
  if (!valid) return new Response('Invalid request signature', { status: 401 });

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('Bad request body', { status: 400 });
  }

  if (payload.type === InteractionType.PING) {
    return json({ type: 1 });
  }

  if (payload.type === InteractionType.APPLICATION_COMMAND && payload.data.name === 'license') {
    const invokerId = payload.member?.user?.id ?? payload.user?.id;
    if (invokerId !== env.ADMIN_USER_ID) {
      return json({ type: 4, data: { content: 'You are not authorized to manage licenses.', flags: 1 << 6 } });
    }
    const response = await handleLicenseCommand(payload, env);
    return json(response);
  }

  if (payload.type === InteractionType.APPLICATION_COMMAND && payload.data.name === 'activate') {
    const response = await handleActivateCommand(payload, env);
    return json(response);
  }

  if (payload.type === InteractionType.MESSAGE_COMPONENT) {
    const [action, proposalId] = payload.data.custom_id.split(':');
    if (action !== 'approve' && action !== 'reject') {
      return json({ type: 4, data: { content: 'Unknown action.', flags: 1 << 6 } });
    }

    const license = await getLicenseByChannelId(env.DB, payload.channel_id);
    if (!license || license.revoked) {
      return json({ type: 4, data: { content: 'This channel is no longer linked to an active license.', flags: 1 << 6 } });
    }

    const invokerId = payload.member?.user?.id ?? payload.user?.id;
    if (invokerId !== license.discord_allowed_user_id) {
      return json({ type: 4, data: { content: 'You are not authorized to review Sentinel proposals.', flags: 1 << 6 } });
    }

    ctx.waitUntil(
      resolveProposalAction({
        action,
        proposalId,
        license,
        applicationId: env.ADMIN_APPLICATION_ID,
        interactionToken: payload.token,
      }),
    );

    return json({ type: 6 }); // DEFERRED_UPDATE_MESSAGE
  }

  return new Response('Unhandled interaction type', { status: 400 });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/interactions' && request.method === 'POST') {
      return handleInteractions(request, env, ctx);
    }

    // One-time-ish setup helper: registers /license and /activate on your bot.
    // Safe to call repeatedly (Discord replaces command definitions).
    if (url.pathname === '/setup-commands' && request.method === 'POST') {
      const key = url.searchParams.get('key');
      if (key !== env.ADMIN_USER_ID) return new Response('Forbidden', { status: 403 });
      await registerCommands(
        env.ADMIN_BOT_TOKEN,
        env.ADMIN_APPLICATION_ID,
        [licenseCommandDefinition, activateCommandDefinition],
        env.ADMIN_GUILD_ID || undefined,
      );
      return new Response('Commands registered.');
    }

    return new Response('Not found', { status: 404 });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        await ensureAdminRow(env);
        await pollAllLicenses(env);
      })(),
    );
  },
};
