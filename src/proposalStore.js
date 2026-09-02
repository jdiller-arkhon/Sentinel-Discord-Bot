import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH = `${__dirname}/../data/posted-proposals.json`;

function load() {
  if (!existsSync(STORE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function save(data) {
  mkdirSync(dirname(STORE_PATH), { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

export function hasPosted(proposalId) {
  const data = load();
  return Boolean(data[proposalId]);
}

export function markPosted(proposalId, messageId) {
  const data = load();
  data[proposalId] = { messageId, postedAt: new Date().toISOString() };
  save(data);
}
