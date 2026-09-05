const fs = require("fs");
const os = require("os");
const path = require("path");

const tmpDbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "securitylog-test-")), "bot.db");
process.env.DISCORD_TOKEN = "test";
process.env.DISCORD_CLIENT_ID = "test";
process.env.GUILD_ID = "test";
process.env.ADMIN_ALERT_CHANNEL_ID = "test";
process.env.DB_PATH = tmpDbPath;
process.env.ADMIN_USER_IDS = "seed-admin-1";

const securityLog = require("../src/securityLog");
const { checkAdmin } = require("../src/authz");

describe("securityLog", () => {
  test("record() then listRecent() round-trips", () => {
    securityLog.record("client_revoked", { discordUserId: "u1", discordUsername: "admin#0001", detail: "revoked Acme (abc123)" });
    const rows = securityLog.listRecent(5);
    expect(rows[0]).toMatchObject({
      event_type: "client_revoked",
      discord_user_id: "u1",
      discord_username: "admin#0001",
      detail: "revoked Acme (abc123)",
    });
  });

  test("listRecent respects the limit and returns newest first", () => {
    securityLog.record("maintenance_enabled", { discordUserId: "u2" });
    securityLog.record("maintenance_disabled", { discordUserId: "u2" });
    const rows = securityLog.listRecent(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].event_type).toBe("maintenance_disabled");
  });
});

describe("authz.checkAdmin", () => {
  test("returns true for an admin and does not log anything", () => {
    const before = securityLog.listRecent(50).length;
    const interaction = { user: { id: "seed-admin-1", tag: "admin#0001" } };
    expect(checkAdmin(interaction, "revoke")).toBe(true);
    expect(securityLog.listRecent(50)).toHaveLength(before);
  });

  test("returns false for a non-admin and records the denial", () => {
    const before = securityLog.listRecent(50).length;
    const interaction = { user: { id: "random-user", tag: "rando#9999" } };
    expect(checkAdmin(interaction, "revoke")).toBe(false);
    const rows = securityLog.listRecent(50);
    expect(rows).toHaveLength(before + 1);
    expect(rows[0]).toMatchObject({
      event_type: "admin_command_denied",
      discord_user_id: "random-user",
      discord_username: "rando#9999",
      detail: "/revoke",
    });
  });
});
