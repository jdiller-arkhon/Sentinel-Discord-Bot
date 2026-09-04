import { config } from './config.js';
import { createBotInstance } from './bot.js';

// This is your own, full-capability Sentinel bot: it does everything a sub-bot does
// (poll your Sentinel instance, post proposals, approve/reject) PLUS the /license
// admin commands used to create and revoke sub-bot licenses for customers. Sub-bots
// spun up by the manager (src/manager.js) are never given `admin`, so they never
// get these commands — this is the only bot instance that has them.
createBotInstance({
  name: 'admin',
  discordBotToken: config.discordBotToken,
  discordChannelId: config.discordChannelId,
  discordAllowedUserId: config.discordAllowedUserId,
  sentinelBaseUrl: config.sentinelBaseUrl,
  pollIntervalSeconds: config.pollIntervalSeconds,
  admin: {
    adminUserId: config.adminUserId,
    guildId: config.adminGuildId,
  },
}).catch((err) => {
  console.error('Failed to start admin bot:', err);
  process.exit(1);
});
