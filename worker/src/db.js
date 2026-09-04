function generateLicenseKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `SENT-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`;
}

export async function getLicenseByApplicationId(db, applicationId) {
  const row = await db
    .prepare('SELECT * FROM licenses WHERE discord_application_id = ?')
    .bind(applicationId)
    .first();
  return row || null;
}

export async function getActiveLicenses(db) {
  const { results } = await db.prepare('SELECT * FROM licenses WHERE revoked = 0').all();
  return results;
}

export async function listLicenses(db) {
  const { results } = await db.prepare('SELECT * FROM licenses ORDER BY created_at DESC').all();
  return results;
}

export async function createLicense(db, record) {
  const licenseKey = generateLicenseKey();
  const createdAt = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO licenses
        (license_key, customer_name, discord_application_id, discord_public_key, discord_bot_token,
         discord_channel_id, discord_allowed_user_id, sentinel_base_url, is_admin, created_at, revoked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0)`,
    )
    .bind(
      licenseKey,
      record.customerName,
      record.discordApplicationId,
      record.discordPublicKey,
      record.discordBotToken,
      record.discordChannelId,
      record.discordAllowedUserId,
      record.sentinelBaseUrl,
      createdAt,
    )
    .run();
  return { licenseKey, createdAt };
}

export async function revokeLicense(db, licenseKey) {
  const result = await db
    .prepare('UPDATE licenses SET revoked = 1, revoked_at = ? WHERE license_key = ? AND is_admin = 0')
    .bind(new Date().toISOString(), licenseKey)
    .run();
  return result.meta.changes > 0;
}

export async function upsertAdminRow(db, admin) {
  await db
    .prepare(
      `INSERT INTO licenses
        (license_key, customer_name, discord_application_id, discord_public_key, discord_bot_token,
         discord_channel_id, discord_allowed_user_id, sentinel_base_url, is_admin, created_at, revoked)
       VALUES ('ADMIN', 'You (admin)', ?, ?, ?, ?, ?, ?, 1, ?, 0)
       ON CONFLICT(license_key) DO UPDATE SET
         discord_application_id = excluded.discord_application_id,
         discord_public_key = excluded.discord_public_key,
         discord_bot_token = excluded.discord_bot_token,
         discord_channel_id = excluded.discord_channel_id,
         discord_allowed_user_id = excluded.discord_allowed_user_id,
         sentinel_base_url = excluded.sentinel_base_url`,
    )
    .bind(
      admin.applicationId,
      admin.publicKey,
      admin.botToken,
      admin.channelId,
      admin.allowedUserId,
      admin.sentinelBaseUrl,
      new Date().toISOString(),
    )
    .run();
}

export async function createPendingCreate(db, record) {
  const id = crypto.randomUUID().slice(0, 8);
  await db
    .prepare(
      `INSERT INTO pending_creates
        (id, customer_name, discord_application_id, discord_public_key, discord_channel_id,
         discord_allowed_user_id, sentinel_base_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      record.customerName,
      record.discordApplicationId,
      record.discordPublicKey,
      record.discordChannelId,
      record.discordAllowedUserId,
      record.sentinelBaseUrl,
      new Date().toISOString(),
    )
    .run();
  return id;
}

export async function consumePendingCreate(db, id) {
  const row = await db.prepare('SELECT * FROM pending_creates WHERE id = ?').bind(id).first();
  if (!row) return null;
  await db.prepare('DELETE FROM pending_creates WHERE id = ?').bind(id).run();
  return row;
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
