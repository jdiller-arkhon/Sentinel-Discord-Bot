import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  discordBotToken: required('DISCORD_BOT_TOKEN'),
  discordChannelId: required('DISCORD_CHANNEL_ID'),
  discordAllowedUserId: required('DISCORD_ALLOWED_USER_ID'),
  sentinelBaseUrl: (process.env.SENTINEL_BASE_URL || 'http://127.0.0.1:8765').replace(/\/+$/, ''),
  pollIntervalSeconds: Number(process.env.POLL_INTERVAL_SECONDS || 60),
  // Admin (license management) slash commands — only meaningful for src/admin.js.
  // Defaults to the same person who approves/rejects proposals on this bot.
  adminUserId: process.env.ADMIN_USER_ID || process.env.DISCORD_ALLOWED_USER_ID,
  // Guild to register admin slash commands in for instant availability.
  // If omitted, commands register globally (can take up to ~1 hour to propagate).
  adminGuildId: process.env.ADMIN_GUILD_ID || null,
};
