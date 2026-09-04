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
