const { Client, GatewayIntentBits, Collection, REST, Routes } = require("discord.js");
const config = require("./config");
const { startPolling } = require("./poller");
const { handleButton } = require("./interactions/buttonHandler");

const onboard = require("./commands/onboard");
const activate = require("./commands/activate");
const status = require("./commands/status");
const help = require("./commands/help");
const pending = require("./commands/pending");
const pause = require("./commands/pause");
const resume = require("./commands/resume");
const history = require("./commands/history");
const audit = require("./commands/audit");
const clients = require("./commands/clients");
const clientInfo = require("./commands/clientInfo");
const revoke = require("./commands/revoke");
const updateClient = require("./commands/updateClient");
const regenerateCode = require("./commands/regenerateCode");
const transferClient = require("./commands/transferClient");
const broadcast = require("./commands/broadcast");
const pollAllCommand = require("./commands/pollAll");
const globalAudit = require("./commands/globalAudit");
const settings = require("./commands/settings");
const maintenance = require("./commands/maintenance");
const adminsCommand = require("./commands/admins");

const commands = [
  onboard,
  activate,
  status,
  help,
  pending,
  pause,
  resume,
  history,
  audit,
  clients,
  clientInfo,
  revoke,
  updateClient,
  regenerateCode,
  transferClient,
  broadcast,
  pollAllCommand,
  globalAudit,
  settings,
  maintenance,
  adminsCommand,
];

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection(commands.map((c) => [c.data.name, c]));

async function registerCommands() {
  const rest = new REST().setToken(config.discordToken);
  await rest.put(Routes.applicationGuildCommands(config.discordClientId, config.guildId), {
    body: commands.map((c) => c.data.toJSON()),
  });
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();
  startPolling(client);
  console.log(`Polling every ${config.pollIntervalMs}ms`);
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
    } else if (interaction.isButton()) {
      await handleButton(interaction);
    }
  } catch (err) {
    console.error("interaction handler failed", err);
    const payload = { content: "Something went wrong handling that.", ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

client.login(config.discordToken);
