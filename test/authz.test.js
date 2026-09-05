process.env.DISCORD_TOKEN = process.env.DISCORD_TOKEN || "test";
process.env.DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || "test";
process.env.GUILD_ID = process.env.GUILD_ID || "test";
process.env.ADMIN_ALERT_CHANNEL_ID = process.env.ADMIN_ALERT_CHANNEL_ID || "test";
process.env.ADMIN_USER_IDS = "admin-1,admin-2";

const { isOwnerOrAdmin, isAdmin, hasPermission } = require("../src/authz");

describe("isOwnerOrAdmin", () => {
  const customer = { discord_user_id: "owner-1" };

  test("true for the channel's owner", () => {
    expect(isOwnerOrAdmin(customer, "owner-1")).toBe(true);
  });

  test("true for an admin, even if not the owner", () => {
    expect(isOwnerOrAdmin(customer, "admin-1")).toBe(true);
  });

  test("false for anyone else", () => {
    expect(isOwnerOrAdmin(customer, "some-other-user")).toBe(false);
  });
});

describe("isAdmin", () => {
  test("true only for configured admin ids", () => {
    expect(isAdmin("admin-2")).toBe(true);
    expect(isAdmin("random-user")).toBe(false);
  });
});

describe("hasPermission", () => {
  test("true when memberPermissions.has() returns true", () => {
    const interaction = { memberPermissions: { has: () => true } };
    expect(hasPermission(interaction, 1n)).toBe(true);
  });

  test("false when memberPermissions.has() returns false", () => {
    const interaction = { memberPermissions: { has: () => false } };
    expect(hasPermission(interaction, 1n)).toBe(false);
  });

  test("false (not a throw) when memberPermissions is missing entirely", () => {
    expect(hasPermission({}, 1n)).toBe(false);
    expect(hasPermission({ memberPermissions: null }, 1n)).toBe(false);
  });
});
