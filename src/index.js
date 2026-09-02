import { Client, GatewayIntentBits } from 'discord.js';
import { config } from './config.js';
import { startPolling } from './poller.js';
import { handleInteraction } from './interactionHandler.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
  startPolling(client);
});

client.on('interactionCreate', (interaction) => {
  handleInteraction(interaction).catch((err) => {
    console.error('Unhandled interaction error:', err);
  });
});

client.login(config.discordBotToken);
