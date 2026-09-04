import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LICENSES_PATH = `${__dirname}/../data/licenses.json`;

function load() {
  if (!existsSync(LICENSES_PATH)) return [];
  try {
    return JSON.parse(readFileSync(LICENSES_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function save(licenses) {
  mkdirSync(dirname(LICENSES_PATH), { recursive: true });
  writeFileSync(LICENSES_PATH, JSON.stringify(licenses, null, 2));
}

export function generateLicenseKey() {
  const groups = Array.from({ length: 4 }, () => randomBytes(2).toString('hex').toUpperCase());
  return `SENT-${groups.join('-')}`;
}

/**
 * record: { customerName, discordBotToken, discordChannelId, discordAllowedUserId,
 *           sentinelBaseUrl, pollIntervalSeconds }
 */
export function createLicense(record) {
  const licenses = load();
  const licenseKey = generateLicenseKey();
  const entry = {
    licenseKey,
    customerName: record.customerName,
    discordBotToken: record.discordBotToken,
    discordChannelId: record.discordChannelId,
    discordAllowedUserId: record.discordAllowedUserId,
    sentinelBaseUrl: record.sentinelBaseUrl || 'http://127.0.0.1:8765',
    pollIntervalSeconds: record.pollIntervalSeconds || 60,
    createdAt: new Date().toISOString(),
    revoked: false,
    revokedAt: null,
  };
  licenses.push(entry);
  save(licenses);
  return entry;
}

export function listLicenses() {
  return load();
}

export function getLicense(licenseKey) {
  return load().find((l) => l.licenseKey === licenseKey) || null;
}

export function revokeLicense(licenseKey) {
  const licenses = load();
  const entry = licenses.find((l) => l.licenseKey === licenseKey);
  if (!entry) return null;
  entry.revoked = true;
  entry.revokedAt = new Date().toISOString();
  save(licenses);
  return entry;
}

export function activeLicenses() {
  return load().filter((l) => !l.revoked);
}
