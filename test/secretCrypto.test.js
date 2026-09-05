const crypto = require("crypto");

process.env.DISCORD_TOKEN = process.env.DISCORD_TOKEN || "test";
process.env.DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || "test";
process.env.GUILD_ID = process.env.GUILD_ID || "test";
process.env.ADMIN_ALERT_CHANNEL_ID = process.env.ADMIN_ALERT_CHANNEL_ID || "test";

describe("secretCrypto with no ENCRYPTION_KEY configured", () => {
  test("encrypt/decrypt are both no-ops (plaintext passthrough)", () => {
    jest.resetModules();
    delete process.env.ENCRYPTION_KEY;
    const secretCrypto = require("../src/secretCrypto");
    expect(secretCrypto.encrypt("my-token")).toBe("my-token");
    expect(secretCrypto.decrypt("my-token")).toBe("my-token");
  });

  test("null/undefined pass through unchanged", () => {
    jest.resetModules();
    delete process.env.ENCRYPTION_KEY;
    const secretCrypto = require("../src/secretCrypto");
    expect(secretCrypto.encrypt(null)).toBeNull();
    expect(secretCrypto.decrypt(undefined)).toBeUndefined();
  });
});

describe("secretCrypto with ENCRYPTION_KEY configured", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
  });

  test("round-trips a value through encrypt then decrypt", () => {
    const secretCrypto = require("../src/secretCrypto");
    const ciphertext = secretCrypto.encrypt("super-secret-token");
    expect(ciphertext).not.toBe("super-secret-token");
    expect(ciphertext.startsWith("enc1:")).toBe(true);
    expect(secretCrypto.decrypt(ciphertext)).toBe("super-secret-token");
  });

  test("still reads old plaintext values written before encryption was enabled", () => {
    const secretCrypto = require("../src/secretCrypto");
    expect(secretCrypto.decrypt("legacy-plaintext-token")).toBe("legacy-plaintext-token");
  });

  test("two encryptions of the same plaintext produce different ciphertext (random IV)", () => {
    const secretCrypto = require("../src/secretCrypto");
    const a = secretCrypto.encrypt("same-value");
    const b = secretCrypto.encrypt("same-value");
    expect(a).not.toBe(b);
    expect(secretCrypto.decrypt(a)).toBe("same-value");
    expect(secretCrypto.decrypt(b)).toBe("same-value");
  });

  test("rejects a key that isn't 32 bytes", () => {
    process.env.ENCRYPTION_KEY = "tooshort";
    const secretCrypto = require("../src/secretCrypto");
    expect(() => secretCrypto.encrypt("x")).toThrow(/32-byte/);
  });
});
