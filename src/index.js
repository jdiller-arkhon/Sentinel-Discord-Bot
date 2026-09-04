import { config } from './config.js';
import { createBotInstance } from './bot.js';

createBotInstance({
  name: 'default',
  discordBotToken: config.discordBotToken,
  discordChannelId: config.discordChannelId,
  discordAllowedUserId: config.discordAllowedUserId,
  sentinelBaseUrl: config.sentinelBaseUrl,
  pollIntervalSeconds: config.pollIntervalSeconds,
}).catch((err) => {
  console.error('Failed to start bot:', err);
  process.exit(1);
});
