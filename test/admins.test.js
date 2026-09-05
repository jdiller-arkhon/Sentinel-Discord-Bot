const fs = require("fs");
const os = require("os");
const path = require("path");

const tmpDbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "admins-test-")), "bot.db");
process.env.DISCORD_TOKEN = "test";
process.env.DISCORD_CLIENT_ID = "test";
process.env.GUILD_ID = "test";
process.env.ADMIN_ALERT_CHANNEL_ID = "test";
process.env.DB_PATH = tmpDbPath;
process.env.ADMIN_USER_IDS = "seed-admin-1";

const admins = require("../src/admins");

describe("admins", () => {
  test("a .env-seeded admin is recognized without being added", () => {
    expect(admins.isAdmin("seed-admin-1")).toBe(true);
    expect(admins.isSeedAdmin("seed-admin-1")).toBe(true);
  });

  test("a random user is not an admin", () => {
    expect(admins.isAdmin("random-user")).toBe(false);
  });

  test("add() grants admin, remove() revokes it", () => {
    expect(admins.isAdmin("runtime-user")).toBe(false);
    admins.add("runtime-user", "seed-admin-1");
    expect(admins.isAdmin("runtime-user")).toBe(true);
    expect(admins.isSeedAdmin("runtime-user")).toBe(false);

    admins.remove("runtime-user");
    expect(admins.isAdmin("runtime-user")).toBe(false);
  });

  test("listRuntimeAdmins reflects additions but not the seed list", () => {
    admins.add("runtime-user-2", "seed-admin-1");
    const list = admins.listRuntimeAdmins();
    expect(list.some((a) => a.discord_user_id === "runtime-user-2")).toBe(true);
    expect(list.some((a) => a.discord_user_id === "seed-admin-1")).toBe(false);
  });

  test("adding the same user twice doesn't error", () => {
    expect(() => {
      admins.add("dup-user", "seed-admin-1");
      admins.add("dup-user", "seed-admin-1");
    }).not.toThrow();
    expect(admins.isAdmin("dup-user")).toBe(true);
  });
});
