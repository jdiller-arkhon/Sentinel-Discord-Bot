require("dotenv").config();

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`missing required env var ${name}`);
  return v;
}

module.exports = {
  discordToken: required("DISCORD_TOKEN"),
  discordClientId: required("DISCORD_CLIENT_ID"),
  guildId: required("GUILD_ID"),
  adminUserIds: new Set((process.env.ADMIN_USER_IDS || "").split(",").map((s) => s.trim()).filter(Boolean)),
  adminAlertChannelId: required("ADMIN_ALERT_CHANNEL_ID"),
  dbPath: process.env.DB_PATH || "./data/bot.db",
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS || 60000),
  failureAlertThreshold: Number(process.env.FAILURE_ALERT_THRESHOLD || 3),
  // Discord's own soft ceiling; we refuse to create a new channel once a
  // guild gets this close to the hard ~500 limit, rather than failing
  // silently inside a slash command.
  maxChannelsPerGuild: 480,
};
