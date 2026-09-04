const API_BASE = 'https://discord.com/api/v10';

async function discordFetch(path, botToken, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${botToken}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Discord API ${path} failed: ${res.status} ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export function postChannelMessage(botToken, channelId, payload) {
  return discordFetch(`/channels/${channelId}/messages`, botToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Used after a deferred interaction response (type 5/6) to fill in the real result.
export function editOriginalInteractionResponse(applicationId, interactionToken, payload) {
  return fetch(`${API_BASE}/webhooks/${applicationId}/${interactionToken}/messages/@original`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function followUpEphemeral(applicationId, interactionToken, content) {
  return fetch(`${API_BASE}/webhooks/${applicationId}/${interactionToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, flags: 1 << 6 }),
  });
}

export function registerCommands(botToken, applicationId, commands, guildId) {
  const path = guildId ? `/applications/${applicationId}/guilds/${guildId}/commands` : `/applications/${applicationId}/commands`;
  return discordFetch(path, botToken, { method: 'PUT', body: JSON.stringify(commands) });
}

// Sets the customer's own Discord Application's Interactions Endpoint URL to this
// Worker, using the bot token they just gave us. Discord synchronously PINGs the
// URL as part of this call and rejects it if verification fails — since we've
// already inserted their license row before calling this, our /interactions
// handler can already find their public key and answer the PING correctly.
export function setInteractionsEndpointUrl(botToken, interactionsUrl) {
  return discordFetch('/applications/@me', botToken, {
    method: 'PATCH',
    body: JSON.stringify({ interactions_endpoint_url: interactionsUrl }),
  });
}

const INVITE_PERMISSIONS = (1 << 11) | (1 << 14); // SEND_MESSAGES | EMBED_LINKS

export function buildInviteUrl(applicationId) {
  return `https://discord.com/oauth2/authorize?client_id=${applicationId}&scope=bot&permissions=${INVITE_PERMISSIONS}`;
}
