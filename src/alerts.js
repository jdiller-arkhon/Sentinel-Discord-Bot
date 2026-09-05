const config = require("./config");

/** Posts to the configured admin alert channel — used for both
 * operational failures (poller) and security-relevant events (denied
 * admin attempts, sensitive admin actions). Swallows its own failures:
 * a misconfigured/unreachable alert channel must never break the
 * action that triggered the alert. */
async function alertAdmins(discordClient, text) {
  try {
    const channel = await discordClient.channels.fetch(config.adminAlertChannelId);
    await channel.send({ content: text });
  } catch (err) {
    console.error("failed to post admin alert", err);
  }
}

module.exports = { alertAdmins };
