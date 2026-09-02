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
};
