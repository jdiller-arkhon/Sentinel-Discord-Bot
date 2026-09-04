import { revokeLicense } from '../src/licenseStore.js';

const licenseKey = process.argv[2];

if (!licenseKey) {
  console.error('Usage: npm run license:revoke -- <LICENSE-KEY>');
  process.exit(1);
}

const entry = revokeLicense(licenseKey);

if (!entry) {
  console.error(`No license found with key ${licenseKey}`);
  process.exit(1);
}

console.log(`Revoked license ${entry.licenseKey} (${entry.customerName}).`);
console.log('If the manager process is running, it will stop this customer\'s bot within 30 seconds.');
