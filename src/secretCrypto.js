/**
 * Encrypts each client's X-Sentinel-Token at rest (AES-256-GCM) so a
 * stolen/leaked copy of the SQLite file doesn't hand over every client's
 * live API credential in plaintext. Opt-in via ENCRYPTION_KEY (a 32-byte
 * hex string) so existing deployments aren't broken by upgrading — with
 * no key configured, tokens are stored as given (a startup warning says
 * so) and decrypt() passes plaintext straight through unchanged.
 */
const crypto = require("crypto");
const config = require("./config");

const ALGO = "aes-256-gcm";
const PREFIX = "enc1:"; // marks a value as our ciphertext, vs. legacy plaintext

function getKey() {
  if (!config.encryptionKey) return null;
  const key = Buffer.from(config.encryptionKey, "hex");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be a 32-byte value, hex-encoded (64 hex characters)");
  }
  return key;
}

function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined) return plaintext;
  const key = getKey();
  if (!key) return plaintext; // encryption not configured — store as-is

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

function decrypt(value) {
  if (value === null || value === undefined) return value;
  if (!value.startsWith(PREFIX)) return value; // legacy plaintext, or encryption not in use

  const key = getKey();
  if (!key) {
    // Ciphertext exists but no key is configured — this is a real
    // misconfiguration (ENCRYPTION_KEY was removed/rotated out from
    // under existing encrypted data), not something to paper over.
    throw new Error("Encrypted value found but ENCRYPTION_KEY is not configured — cannot decrypt.");
  }

  const raw = Buffer.from(value.slice(PREFIX.length), "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

module.exports = { encrypt, decrypt };
