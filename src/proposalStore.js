import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = `${__dirname}/../data`;

function safeName(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function createProposalStore(instanceName = 'default') {
  const storePath = `${DATA_DIR}/posted-proposals${instanceName === 'default' ? '' : `.${safeName(instanceName)}`}.json`;

  function load() {
    if (!existsSync(storePath)) return {};
    try {
      return JSON.parse(readFileSync(storePath, 'utf8'));
    } catch {
      return {};
    }
  }

  function save(data) {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(storePath, JSON.stringify(data, null, 2));
  }

  return {
    hasPosted(proposalId) {
      return Boolean(load()[proposalId]);
    },
    markPosted(proposalId, messageId) {
      const data = load();
      data[proposalId] = { messageId, postedAt: new Date().toISOString() };
      save(data);
    },
  };
}
