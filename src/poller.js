const db = require("./db");
const runtimeSettings = require("./runtimeSettings");
const { SentinelClient } = require("./sentinelClient");
const { proposalEmbed, proposalActionRow } = require("./embeds");
const { alertAdmins } = require("./alerts");

const listActiveCustomers = db.prepare("SELECT * FROM customers WHERE active = 1 AND activated = 1");
const isPosted = db.prepare("SELECT 1 FROM posted_proposals WHERE customer_id = ? AND proposal_id = ?");
const markPosted = db.prepare(
  "INSERT INTO posted_proposals (customer_id, proposal_id, message_id, posted_at) VALUES (?, ?, ?, ?)"
);
const recordPollResult = db.prepare(`
  UPDATE customers
  SET consecutive_failures = @consecutiveFailures,
      alerted_failure = @alertedFailure,
      last_poll_at = @lastPollAt,
      last_poll_ok = @lastPollOk,
      last_error = @lastError
  WHERE id = @id
`);

async function pollCustomer(discordClient, customer) {
  const sentinel = SentinelClient.forCustomer(customer);
  const now = new Date().toISOString();

  let proposals;
  try {
    proposals = await sentinel.getPendingProposals();
  } catch (err) {
    const consecutiveFailures = customer.consecutive_failures + 1;
    const shouldAlert = consecutiveFailures >= runtimeSettings.get().failureAlertThreshold && !customer.alerted_failure;
    recordPollResult.run({
      id: customer.id,
      consecutiveFailures,
      alertedFailure: shouldAlert ? 1 : customer.alerted_failure,
      lastPollAt: now,
      lastPollOk: 0,
      lastError: err.message,
    });
    if (shouldAlert) {
      await alertAdmins(
        discordClient,
        `:rotating_light: **${customer.name}** (\`${customer.id}\`) has failed to poll Sentinel ` +
          `${consecutiveFailures} times in a row.\nLast error: \`${err.message}\`\n` +
          `Base URL: ${customer.sentinel_base_url}`
      );
    }
    return { ok: false, error: err.message, postedCount: 0 };
  }

  // Recovered (or was already healthy) — clear the failure streak and
  // let a future failure streak re-alert instead of staying silenced.
  if (customer.consecutive_failures > 0 || customer.alerted_failure) {
    recordPollResult.run({
      id: customer.id,
      consecutiveFailures: 0,
      alertedFailure: 0,
      lastPollAt: now,
      lastPollOk: 1,
      lastError: null,
    });
    if (customer.alerted_failure) {
      await alertAdmins(discordClient, `:white_check_mark: **${customer.name}** (\`${customer.id}\`) is polling again.`);
    }
  } else {
    recordPollResult.run({
      id: customer.id,
      consecutiveFailures: 0,
      alertedFailure: 0,
      lastPollAt: now,
      lastPollOk: 1,
      lastError: null,
    });
  }

  const channel = await discordClient.channels.fetch(customer.channel_id).catch(() => null);
  if (!channel) {
    console.error(`customer ${customer.id} channel ${customer.channel_id} is not reachable`);
    return { ok: false, error: "channel not reachable", postedCount: 0 };
  }

  let postedCount = 0;
  for (const proposal of proposals) {
    if (isPosted.get(customer.id, proposal.id)) continue;
    try {
      const message = await channel.send({
        embeds: [proposalEmbed(proposal)],
        components: [proposalActionRow(proposal.id)],
      });
      markPosted.run(customer.id, proposal.id, message.id, new Date().toISOString());
      postedCount += 1;
    } catch (err) {
      // A single bad proposal (e.g. one that still blew past Discord's
      // limits some other way) shouldn't stop the rest from posting, and
      // it's still worth escalating rather than only console.error.
      console.error(`failed to post proposal ${proposal.id} for customer ${customer.id}`, err);
      await alertAdmins(
        discordClient,
        `:warning: Failed to post proposal \`${proposal.id}\` for **${customer.name}**: \`${err.message}\``
      );
    }
  }

  return { ok: true, error: null, postedCount, pendingCount: proposals.length };
}

async function pollAll(discordClient) {
  const { maintenanceMode } = runtimeSettings.get();
  if (maintenanceMode) {
    return { skipped: true, reason: "maintenance mode", customerCount: 0 };
  }

  const customers = listActiveCustomers.all();
  const results = await Promise.allSettled(customers.map((c) => pollCustomer(discordClient, c)));
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`unexpected poll failure for customer ${customers[i].id}`, r.reason);
    }
  });
  return {
    skipped: false,
    customerCount: customers.length,
    postedCount: results.reduce((sum, r) => sum + (r.status === "fulfilled" ? r.value?.postedCount ?? 0 : 0), 0),
  };
}

// Self-rescheduling rather than a fixed setInterval, so a poll-interval
// change made via /settings takes effect on the very next tick instead
// of requiring a bot restart.
function startPolling(discordClient) {
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      await pollAll(discordClient);
    } catch (err) {
      console.error("poll cycle failed", err);
    }
    if (!stopped) setTimeout(tick, runtimeSettings.get().pollIntervalMs);
  };
  tick();
  return () => {
    stopped = true;
  };
}

module.exports = { startPolling, pollAll, pollCustomer };
