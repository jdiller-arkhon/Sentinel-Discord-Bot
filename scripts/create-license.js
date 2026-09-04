import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';
import { createLicense } from '../src/licenseStore.js';

const rl = createInterface({ input: stdin });
const lineIterator = rl[Symbol.asyncIterator]();

async function ask(question, fallback) {
  const suffix = fallback ? ` [${fallback}]` : '';
  stdout.write(`${question}${suffix}: `);
  const { value, done } = await lineIterator.next();
  if (done) return fallback;
  return value.trim() || fallback;
}

async function main() {
  console.log('Create a new customer license for the Sentinel Discord bot.\n');
  console.log('The customer must first create their own Discord Application + bot user');
  console.log('at https://discord.com/developers/applications and invite it to their server.\n');

  const customerName = await ask('Customer name');
  const discordBotToken = await ask("Customer's Discord bot token");
  const discordChannelId = await ask('Discord channel id to post proposals in');
  const discordAllowedUserId = await ask('Discord user id allowed to approve/reject');
  const sentinelBaseUrl = await ask('Sentinel base URL', 'http://127.0.0.1:8765');
  const pollIntervalSecondsRaw = await ask('Poll interval seconds', '60');

  rl.close();

  if (!customerName || !discordBotToken || !discordChannelId || !discordAllowedUserId) {
    console.error('\nCustomer name, bot token, channel id, and allowed user id are all required.');
    process.exit(1);
  }

  const entry = createLicense({
    customerName,
    discordBotToken,
    discordChannelId,
    discordAllowedUserId,
    sentinelBaseUrl,
    pollIntervalSeconds: Number(pollIntervalSecondsRaw) || 60,
  });

  console.log('\nLicense created:');
  console.log(`  License key : ${entry.licenseKey}`);
  console.log(`  Customer    : ${entry.customerName}`);
  console.log(`  Created at  : ${entry.createdAt}`);
  console.log('\nThis record (including their bot token) is stored in data/licenses.json.');
  console.log('Run `npm run manager` to start bots for every active license, this one included.');
}

main();
