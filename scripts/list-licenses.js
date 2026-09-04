import { listLicenses } from '../src/licenseStore.js';

function mask(token) {
  if (!token) return '';
  return token.length <= 8 ? '****' : `${token.slice(0, 4)}...${token.slice(-4)}`;
}

const licenses = listLicenses();

if (licenses.length === 0) {
  console.log('No licenses yet. Create one with `npm run license:create`.');
  process.exit(0);
}

for (const l of licenses) {
  console.log(`${l.revoked ? '[revoked]' : '[active] '} ${l.licenseKey}  ${l.customerName}`);
  console.log(`           channel=${l.discordChannelId}  user=${l.discordAllowedUserId}  token=${mask(l.discordBotToken)}  sentinel=${l.sentinelBaseUrl}`);
  console.log(`           createdAt=${l.createdAt}${l.revokedAt ? `  revokedAt=${l.revokedAt}` : ''}`);
}
