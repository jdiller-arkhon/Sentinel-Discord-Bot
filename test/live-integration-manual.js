/**
 * Manual, opt-in integration script — NOT run by `npm test`. Exercises
 * the bot's real, unmocked SentinelClient + embed builder against a
 * genuinely running Sentinel backend (no Discord involved), to prove
 * the actual HTTP contract works end-to-end rather than a mocked one.
 *
 * Usage: SENTINEL_URL=http://127.0.0.1:8765 SENTINEL_TOKEN=... node test/live-integration-manual.js
 */
const { SentinelClient } = require("../src/sentinelClient");
const { proposalEmbed, FIELD_VALUE_LIMIT } = require("../src/embeds");

async function main() {
  const baseUrl = process.env.SENTINEL_URL;
  const token = process.env.SENTINEL_TOKEN;
  if (!baseUrl) throw new Error("set SENTINEL_URL");

  const withToken = new SentinelClient({ baseUrl, token });
  const withoutToken = new SentinelClient({ baseUrl, token: undefined });

  console.log("1) GET /ai/proposals with correct token...");
  const proposals = await withToken.getPendingProposals();
  console.log(`   got ${proposals.length} pending proposal(s)`);
  if (proposals.length === 0) throw new Error("expected at least one pending proposal (seed one first)");

  console.log("2) GET /ai/proposals with NO token (should 401)...");
  try {
    await withoutToken.getPendingProposals();
    throw new Error("expected a 401, got success");
  } catch (err) {
    if (err.status !== 401) throw err;
    console.log(`   got real 401 from live server: ${err.detail}`);
  }

  console.log("3) Building the real Discord embed for the largest pending proposal...");
  const big = proposals.reduce((a, b) => (JSON.stringify(a).length > JSON.stringify(b).length ? a : b));
  const embed = proposalEmbed(big).toJSON();
  for (const field of embed.fields) {
    if (field.value.length > FIELD_VALUE_LIMIT) {
      throw new Error(`field ${field.name} exceeds Discord's ${FIELD_VALUE_LIMIT}-char limit`);
    }
  }
  console.log(`   all ${embed.fields.length} fields within Discord's ${FIELD_VALUE_LIMIT}-char limit`);
  console.log(`   embed title: "${embed.title}"`);

  console.log("4) Approving proposal via the real API...");
  const result = await withToken.approveProposal(big.id);
  console.log(`   approve response: applied=${result.applied}, status=${result.proposal.status}`);

  console.log("5) Approving again (should 400, already reviewed)...");
  try {
    await withToken.approveProposal(big.id);
    throw new Error("expected a 400, got success");
  } catch (err) {
    if (err.status !== 400) throw err;
    console.log(`   got real 400 from live server: ${err.detail}`);
  }

  console.log("\nAll live checks passed against a real Sentinel instance.");
}

main().catch((err) => {
  console.error("LIVE INTEGRATION FAILED:", err);
  process.exit(1);
});
