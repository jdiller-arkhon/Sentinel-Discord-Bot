import { activeLicenses } from './licenseStore.js';
import { createBotInstance } from './bot.js';

const RECONCILE_INTERVAL_SECONDS = 30;

const running = new Map(); // licenseKey -> { instance, config }

function sameConfig(a, b) {
  return (
    a.discordBotToken === b.discordBotToken &&
    a.discordChannelId === b.discordChannelId &&
    a.discordAllowedUserId === b.discordAllowedUserId &&
    a.sentinelBaseUrl === b.sentinelBaseUrl &&
    a.pollIntervalSeconds === b.pollIntervalSeconds
  );
}

async function reconcile() {
  const desired = activeLicenses();
  const desiredKeys = new Set(desired.map((l) => l.licenseKey));

  // Stop bots for licenses that were revoked or removed.
  for (const [licenseKey, entry] of running) {
    if (!desiredKeys.has(licenseKey)) {
      console.log(`[manager] Stopping bot for revoked/removed license ${licenseKey}`);
      await entry.instance.stop().catch((err) => console.error(`[manager] Error stopping ${licenseKey}:`, err));
      running.delete(licenseKey);
    }
  }

  // Start bots for new licenses, or restart ones whose config changed.
  for (const license of desired) {
    const existing = running.get(license.licenseKey);
    if (existing && sameConfig(existing.config, license)) continue;

    if (existing) {
      console.log(`[manager] Config changed for ${license.licenseKey}, restarting`);
      await existing.instance.stop().catch((err) => console.error(`[manager] Error stopping ${license.licenseKey}:`, err));
      running.delete(license.licenseKey);
    }

    console.log(`[manager] Starting bot for license ${license.licenseKey} (${license.customerName})`);
    try {
      const instance = await createBotInstance({
        name: license.licenseKey,
        discordBotToken: license.discordBotToken,
        discordChannelId: license.discordChannelId,
        discordAllowedUserId: license.discordAllowedUserId,
        sentinelBaseUrl: license.sentinelBaseUrl,
        pollIntervalSeconds: license.pollIntervalSeconds,
      });
      running.set(license.licenseKey, { instance, config: license });
    } catch (err) {
      console.error(`[manager] Failed to start bot for license ${license.licenseKey} (${license.customerName}):`, err.message);
    }
  }
}

async function main() {
  console.log('[manager] Starting Sentinel Discord bot manager');
  await reconcile();
  setInterval(() => {
    reconcile().catch((err) => console.error('[manager] Reconcile failed:', err));
  }, RECONCILE_INTERVAL_SECONDS * 1000);
}

main();
