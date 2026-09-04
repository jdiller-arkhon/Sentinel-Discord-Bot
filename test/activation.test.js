const fs = require("fs");
const os = require("os");
const path = require("path");

// db.js opens its file at require-time from config.dbPath, so point that
// at a scratch file per test run before either module is required.
const tmpDbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "activation-test-")), "bot.db");
process.env.DISCORD_TOKEN = "test";
process.env.DISCORD_CLIENT_ID = "test";
process.env.GUILD_ID = "test";
process.env.ADMIN_ALERT_CHANNEL_ID = "test";
process.env.DB_PATH = tmpDbPath;

const db = require("../src/db");
const {
  generateActivationCode,
  hashCode,
  recordAttempt,
  isLockedOut,
  findPendingCustomerByCode,
  LOCKOUT_MAX_FAILURES,
} = require("../src/activation");

const insertPendingCustomer = db.prepare(`
  INSERT INTO customers (id, name, channel_id, sentinel_base_url, activated, activation_code_hash, activation_code_expires_at, created_at)
  VALUES (@id, @name, @channelId, @sentinelBaseUrl, 0, @activationCodeHash, @activationCodeExpiresAt, @createdAt)
`);

function seedPendingCustomer(hash, expiresAt) {
  insertPendingCustomer.run({
    id: `cust-${Math.random()}`,
    name: "Test Client",
    channelId: `chan-${Math.random()}`,
    sentinelBaseUrl: "http://example.test",
    activationCodeHash: hash,
    activationCodeExpiresAt: expiresAt,
    createdAt: new Date().toISOString(),
  });
}

describe("generateActivationCode", () => {
  test("produces a high-entropy code whose hash matches hashCode()", () => {
    const { code, hash } = generateActivationCode();
    expect(code).toMatch(/^[0-9a-f]{32}$/); // 16 bytes hex
    expect(hashCode(code)).toBe(hash);
  });

  test("two generated codes never collide in practice", () => {
    const a = generateActivationCode();
    const b = generateActivationCode();
    expect(a.code).not.toBe(b.code);
  });
});

describe("findPendingCustomerByCode", () => {
  test("finds a customer by the raw code, not the hash", () => {
    const { code, hash } = generateActivationCode();
    seedPendingCustomer(hash, new Date(Date.now() + 60000).toISOString());
    const found = findPendingCustomerByCode(code);
    expect(found).not.toBeNull();
    expect(found.activation_code_hash).toBe(hash);
  });

  test("returns null for a code that doesn't match anything", () => {
    expect(findPendingCustomerByCode("not-a-real-code")).toBeNull();
  });

  test("returns null for an expired code even if the hash matches", () => {
    const { code, hash } = generateActivationCode();
    seedPendingCustomer(hash, new Date(Date.now() - 1000).toISOString());
    expect(findPendingCustomerByCode(code)).toBeNull();
  });
});

describe("lockout", () => {
  test("is not locked out with no attempts", () => {
    expect(isLockedOut("user-a")).toBe(false);
  });

  test("locks out after LOCKOUT_MAX_FAILURES failed attempts", () => {
    for (let i = 0; i < LOCKOUT_MAX_FAILURES - 1; i++) recordAttempt("user-b", false);
    expect(isLockedOut("user-b")).toBe(false);
    recordAttempt("user-b", false);
    expect(isLockedOut("user-b")).toBe(true);
  });

  test("a successful attempt does not count toward lockout", () => {
    for (let i = 0; i < LOCKOUT_MAX_FAILURES; i++) recordAttempt("user-c", true);
    expect(isLockedOut("user-c")).toBe(false);
  });

  test("lockout is per-user", () => {
    for (let i = 0; i < LOCKOUT_MAX_FAILURES; i++) recordAttempt("user-d", false);
    expect(isLockedOut("user-d")).toBe(true);
    expect(isLockedOut("user-e")).toBe(false);
  });
});
