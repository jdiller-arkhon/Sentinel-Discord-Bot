const fs = require("fs");
const os = require("os");
const path = require("path");

const tmpDbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "runtime-settings-test-")), "bot.db");
process.env.DISCORD_TOKEN = "test";
process.env.DISCORD_CLIENT_ID = "test";
process.env.GUILD_ID = "test";
process.env.ADMIN_ALERT_CHANNEL_ID = "test";
process.env.DB_PATH = tmpDbPath;
process.env.POLL_INTERVAL_MS = "60000";
process.env.FAILURE_ALERT_THRESHOLD = "3";

const runtimeSettings = require("../src/runtimeSettings");

describe("runtimeSettings", () => {
  test("falls back to .env defaults before any override is set", () => {
    const current = runtimeSettings.get();
    expect(current.pollIntervalMs).toBe(60000);
    expect(current.failureAlertThreshold).toBe(3);
    expect(current.maintenanceMode).toBe(false);
  });

  test("setPollIntervalMs overrides just that field", () => {
    runtimeSettings.setPollIntervalMs(15000);
    const current = runtimeSettings.get();
    expect(current.pollIntervalMs).toBe(15000);
    expect(current.failureAlertThreshold).toBe(3); // untouched
  });

  test("setFailureAlertThreshold overrides just that field, preserving the poll interval override", () => {
    runtimeSettings.setFailureAlertThreshold(5);
    const current = runtimeSettings.get();
    expect(current.failureAlertThreshold).toBe(5);
    expect(current.pollIntervalMs).toBe(15000); // preserved from the previous test
  });

  test("setMaintenance(true, reason) sets mode and reason; (false) clears the reason", () => {
    runtimeSettings.setMaintenance(true, "DB migration");
    expect(runtimeSettings.get()).toMatchObject({ maintenanceMode: true, maintenanceReason: "DB migration" });

    runtimeSettings.setMaintenance(false);
    expect(runtimeSettings.get()).toMatchObject({ maintenanceMode: false, maintenanceReason: null });
  });
});
