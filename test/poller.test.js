const fs = require("fs");
const os = require("os");
const path = require("path");

const tmpDbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "poller-test-")), "bot.db");
process.env.DISCORD_TOKEN = "test";
process.env.DISCORD_CLIENT_ID = "test";
process.env.GUILD_ID = "test";
process.env.ADMIN_ALERT_CHANNEL_ID = "test";
process.env.DB_PATH = tmpDbPath;

const runtimeSettings = require("../src/runtimeSettings");
const { pollAll } = require("../src/poller");

describe("pollAll under maintenance mode", () => {
  test("skips entirely and never touches the Discord client when maintenance mode is on", async () => {
    runtimeSettings.setMaintenance(true, "testing");
    // A discordClient that throws if anything on it is touched — proves
    // maintenance mode short-circuits before any Discord/Sentinel call.
    const poisonedClient = new Proxy(
      {},
      {
        get() {
          throw new Error("should not touch the Discord client during maintenance mode");
        },
      }
    );

    const result = await pollAll(poisonedClient);
    expect(result).toMatchObject({ skipped: true, reason: "maintenance mode" });
  });

  test("does not skip once maintenance mode is turned off", async () => {
    runtimeSettings.setMaintenance(false);
    const result = await pollAll({ channels: { fetch: async () => null } });
    expect(result.skipped).toBe(false);
    expect(result.customerCount).toBe(0); // no customers seeded in this test DB
  });
});
