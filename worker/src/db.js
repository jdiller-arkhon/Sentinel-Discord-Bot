function generateLicenseKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `SENT-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`;
}

export async function createLicense(db, customerName) {
  const licenseKey = generateLicenseKey();
  await db
    .prepare('INSERT INTO licenses (license_key, customer_name, activated, created_at, revoked) VALUES (?, ?, 0, ?, 0)')
    .bind(licenseKey, customerName, new Date().toISOString())
    .run();
  return licenseKey;
}

export async function getLicense(db, licenseKey) {
  return (await db.prepare('SELECT * FROM licenses WHERE license_key = ?').bind(licenseKey).first()) || null;
}

export async function getLicenseByChannelId(db, channelId) {
  return (await db.prepare('SELECT * FROM licenses WHERE discord_channel_id = ?').bind(channelId).first()) || null;
}

export async function activateLicense(db, licenseKey, { channelId, allowedUserId, sentinelBaseUrl, sentinelToken }) {
  await db
    .prepare(
      `UPDATE licenses
       SET discord_channel_id = ?, discord_allowed_user_id = ?, sentinel_base_url = ?, sentinel_token = ?, activated = 1, activated_at = ?
       WHERE license_key = ?`,
    )
    .bind(channelId, allowedUserId, sentinelBaseUrl, sentinelToken || null, new Date().toISOString(), licenseKey)
    .run();
}

export async function listLicenses(db) {
  const { results } = await db.prepare("SELECT * FROM licenses WHERE license_key != 'ADMIN' ORDER BY created_at DESC").all();
  return results;
}

export async function revokeLicense(db, licenseKey) {
  const result = await db
    .prepare("UPDATE licenses SET revoked = 1, revoked_at = ? WHERE license_key = ? AND license_key != 'ADMIN'")
    .bind(new Date().toISOString(), licenseKey)
    .run();
  return result.meta.changes > 0;
}

export async function getActiveLicenses(db) {
  const { results } = await db.prepare('SELECT * FROM licenses WHERE activated = 1 AND revoked = 0').all();
  return results;
}

export async function upsertAdminRow(db, admin) {
  await db
    .prepare(
      `INSERT INTO licenses
        (license_key, customer_name, discord_channel_id, discord_allowed_user_id, sentinel_base_url, sentinel_token, activated, created_at, revoked)
       VALUES ('ADMIN', 'You (admin)', ?, ?, ?, ?, 1, ?, 0)
       ON CONFLICT(license_key) DO UPDATE SET
         discord_channel_id = excluded.discord_channel_id,
         discord_allowed_user_id = excluded.discord_allowed_user_id,
         sentinel_base_url = excluded.sentinel_base_url,
         sentinel_token = excluded.sentinel_token`,
    )
    .bind(admin.channelId, admin.allowedUserId, admin.sentinelBaseUrl, admin.sentinelToken || null, new Date().toISOString())
    .run();
}

export async function hasPosted(db, licenseKey, proposalId) {
  const row = await db
    .prepare('SELECT 1 FROM posted_proposals WHERE license_key = ? AND proposal_id = ?')
    .bind(licenseKey, proposalId)
    .first();
  return Boolean(row);
}

export async function markPosted(db, licenseKey, proposalId, messageId) {
  await db
    .prepare('INSERT OR IGNORE INTO posted_proposals (license_key, proposal_id, message_id, posted_at) VALUES (?, ?, ?, ?)')
    .bind(licenseKey, proposalId, messageId, new Date().toISOString())
    .run();
}
