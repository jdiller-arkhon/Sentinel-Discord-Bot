const db = require("./db");
const config = require("./config");

const SETTINGS_ID = 1;
const getRow = db.prepare("SELECT * FROM runtime_settings WHERE id = ?");
const upsert = db.prepare(`
  INSERT INTO runtime_settings (id, poll_interval_ms, failure_alert_threshold, maintenance_mode, maintenance_reason, updated_at)
  VALUES (@id, @pollIntervalMs, @failureAlertThreshold, @maintenanceMode, @maintenanceReason, @updatedAt)
  ON CONFLICT(id) DO UPDATE SET
    poll_interval_ms = @pollIntervalMs,
    failure_alert_threshold = @failureAlertThreshold,
    maintenance_mode = @maintenanceMode,
    maintenance_reason = @maintenanceReason,
    updated_at = @updatedAt
`);

/** Effective settings: an explicit runtime override if one was ever set,
 * falling back to the .env-configured default — so /settings can change
 * behavior immediately, without a restart, while staying opt-in. */
function get() {
  const row = getRow.get(SETTINGS_ID);
  return {
    pollIntervalMs: row?.poll_interval_ms ?? config.pollIntervalMs,
    failureAlertThreshold: row?.failure_alert_threshold ?? config.failureAlertThreshold,
    maintenanceMode: !!row?.maintenance_mode,
    maintenanceReason: row?.maintenance_reason ?? null,
  };
}

function save(overrides) {
  const current = getRow.get(SETTINGS_ID);
  upsert.run({
    id: SETTINGS_ID,
    pollIntervalMs: overrides.pollIntervalMs ?? current?.poll_interval_ms ?? null,
    failureAlertThreshold: overrides.failureAlertThreshold ?? current?.failure_alert_threshold ?? null,
    maintenanceMode: overrides.maintenanceMode ?? current?.maintenance_mode ?? 0,
    maintenanceReason: overrides.maintenanceReason !== undefined ? overrides.maintenanceReason : current?.maintenance_reason ?? null,
    updatedAt: new Date().toISOString(),
  });
  return get();
}

function setPollIntervalMs(ms) {
  return save({ pollIntervalMs: ms });
}

function setFailureAlertThreshold(n) {
  return save({ failureAlertThreshold: n });
}

function setMaintenance(enabled, reason) {
  return save({ maintenanceMode: enabled ? 1 : 0, maintenanceReason: enabled ? reason ?? null : null });
}

module.exports = { get, setPollIntervalMs, setFailureAlertThreshold, setMaintenance };
