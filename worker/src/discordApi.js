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

export function registerCommands(botToken, applicationId, commands, guildId) {
  const path = guildId ? `/applications/${applicationId}/guilds/${guildId}/commands` : `/applications/${applicationId}/commands`;
  return discordFetch(path, botToken, { method: 'PUT', body: JSON.stringify(commands) });
}

const PERMISSION_VIEW_CHANNEL = 1n << 10n;
const PERMISSION_SEND_MESSAGES = 1n << 11n;
const PERMISSION_READ_HISTORY = 1n << 16n;
const PERMISSION_EMBED_LINKS = 1n << 14n;

// Creates a private text channel visible only to `userId` and the bot itself.
// `everyoneRoleId` is always the guild's id (Discord's @everyone role id == guild id).
export function createPrivateChannel(botToken, { guildId, botUserId, userId, name, parentId }) {
  const allowUser = (PERMISSION_VIEW_CHANNEL | PERMISSION_SEND_MESSAGES | PERMISSION_READ_HISTORY).toString();
  const allowBot = (PERMISSION_VIEW_CHANNEL | PERMISSION_SEND_MESSAGES | PERMISSION_READ_HISTORY | PERMISSION_EMBED_LINKS).toString();

  return discordFetch(`/guilds/${guildId}/channels`, botToken, {
    method: 'POST',
    body: JSON.stringify({
      name,
      type: 0, // GUILD_TEXT
      parent_id: parentId || undefined,
      permission_overwrites: [
        { id: guildId, type: 0, deny: PERMISSION_VIEW_CHANNEL.toString() },
        { id: userId, type: 1, allow: allowUser },
        { id: botUserId, type: 1, allow: allowBot },
      ],
    }),
  });
}

// Removes a specific member's access to a channel — used on revoke, without
// deleting the channel or its history.
export function denyChannelAccess(botToken, channelId, userId) {
  return discordFetch(`/channels/${channelId}/permissions/${userId}`, botToken, {
    method: 'PUT',
    body: JSON.stringify({ type: 1, deny: PERMISSION_VIEW_CHANNEL.toString(), allow: '0' }),
  });
}
