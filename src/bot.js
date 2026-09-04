import { Client, GatewayIntentBits } from 'discord.js';
import { createSentinelClient } from './sentinelClient.js';
import { createProposalStore } from './proposalStore.js';
import { startPolling } from './poller.js';
import { createInteractionHandler } from './interactionHandler.js';

/**
 * Wires up and logs in one fully isolated bot instance.
 *
 * instanceConfig: {
 *   name,                    // used for log prefixes and the per-instance proposal store file
 *   discordBotToken,
 *   discordChannelId,
 *   discordAllowedUserId,
 *   sentinelBaseUrl,
 *   pollIntervalSeconds,
 * }
 *
 * Returns { client, stop() } — stop() cancels polling and destroys the client.
 */
export async function createBotInstance(instanceConfig) {
  const {
    name = 'default',
    discordBotToken,
    discordChannelId,
    discordAllowedUserId,
    sentinelBaseUrl,
    pollIntervalSeconds = 60,
  } = instanceConfig;

  const log = {
    log: (...args) => console.log(`[${name}]`, ...args),
    error: (...args) => console.error(`[${name}]`, ...args),
  };

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const sentinelClient = createSentinelClient(sentinelBaseUrl);
  const store = createProposalStore(name);
  const handleInteraction = createInteractionHandler({ allowedUserId: discordAllowedUserId, sentinelClient, log });

  let stopPolling = () => {};

  client.once('clientReady', () => {
    log.log(`Logged in as ${client.user.tag}`);
    stopPolling = startPolling({ client, channelId: discordChannelId, pollIntervalSeconds, sentinelClient, store, log });
  });

  client.on('interactionCreate', (interaction) => {
    handleInteraction(interaction).catch((err) => log.error('Unhandled interaction error:', err));
  });

  client.on('error', (err) => log.error('Client error:', err));

  await client.login(discordBotToken);

  return {
    client,
    stop: async () => {
      stopPolling();
      await client.destroy();
    },
  };
}
