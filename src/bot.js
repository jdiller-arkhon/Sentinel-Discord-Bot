import { Client, GatewayIntentBits } from 'discord.js';
import { createSentinelClient } from './sentinelClient.js';
import { createProposalStore } from './proposalStore.js';
import { startPolling } from './poller.js';
import { createInteractionHandler } from './interactionHandler.js';
import { createAdminInteractionHandler, registerAdminCommands } from './adminCommands.js';

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
 *   admin,                   // optional: { adminUserId, guildId } — only your own
 *                             // full-capability bot should set this. Sub-bots created via
 *                             // licenses never receive it and get no admin commands at all.
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
    admin = null,
  } = instanceConfig;

  const log = {
    log: (...args) => console.log(`[${name}]`, ...args),
    error: (...args) => console.error(`[${name}]`, ...args),
  };

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const sentinelClient = createSentinelClient(sentinelBaseUrl);
  const store = createProposalStore(name);
  const handleInteraction = createInteractionHandler({ allowedUserId: discordAllowedUserId, sentinelClient, log });
  const handleAdminInteraction = admin ? createAdminInteractionHandler({ adminUserId: admin.adminUserId, log }) : null;

  let stopPolling = () => {};

  client.once('clientReady', async () => {
    log.log(`Logged in as ${client.user.tag}`);
    stopPolling = startPolling({ client, channelId: discordChannelId, pollIntervalSeconds, sentinelClient, store, log });

    if (admin) {
      try {
        await registerAdminCommands(client, admin.guildId);
        log.log(`Registered admin license commands${admin.guildId ? ` in guild ${admin.guildId}` : ' globally'}`);
      } catch (err) {
        log.error('Failed to register admin commands:', err);
      }
    }
  });

  client.on('interactionCreate', (interaction) => {
    // Sub-bots (no `admin` config) never see chat-input commands or modals routed
    // anywhere — they only have the button handler, so they cannot manage licenses
    // even if someone tried to invoke a command on them.
    const isAdminInteraction = interaction.isChatInputCommand?.() || interaction.isModalSubmit?.();
    const handler = isAdminInteraction && handleAdminInteraction ? handleAdminInteraction : handleInteraction;
    handler(interaction).catch((err) => log.error('Unhandled interaction error:', err));
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
