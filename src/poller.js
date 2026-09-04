const db = require("./db");
const config = require("./config");
const { SentinelClient } = require("./sentinelClient");
const { proposalEmbed, proposalActionRow } = require("./embeds");

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

async function alertAdmins(client, text) {
  try {
    const channel = await client.channels.fetch(config.adminAlertChannelId);
    await channel.send({ content: text });
  } catch (err) {
    // Last resort — the admin alert channel itself is misconfigured or
    // unreachable. Nothing else to escalate to.
    console.error("failed to post admin alert", err);
  }
}

async function pollCustomer(discordClient, customer) {
  const sentinel = new SentinelClient({ baseUrl: customer.sentinel_base_url, token: customer.sentinel_token });
  const now = new Date().toISOString();

  let proposals;
  try {
    proposals = await sentinel.getPendingProposals();
  } catch (err) {
    const consecutiveFailures = customer.consecutive_failures + 1;
    const shouldAlert = consecutiveFailures >= config.failureAlertThreshold && !customer.alerted_failure;
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
    return;
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
    return;
  }

  for (const proposal of proposals) {
    if (isPosted.get(customer.id, proposal.id)) continue;
    try {
      const message = await channel.send({
        embeds: [proposalEmbed(proposal)],
        components: [proposalActionRow(proposal.id)],
      });
      markPosted.run(customer.id, proposal.id, message.id, new Date().toISOString());
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
}

async function pollAll(discordClient) {
  const customers = listActiveCustomers.all();
  const results = await Promise.allSettled(customers.map((c) => pollCustomer(discordClient, c)));
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`unexpected poll failure for customer ${customers[i].id}`, r.reason);
    }
  });
}

function startPolling(discordClient) {
  const tick = () => pollAll(discordClient).catch((err) => console.error("poll cycle failed", err));
  tick();
  return setInterval(tick, config.pollIntervalMs);
}

module.exports = { startPolling, pollAll, pollCustomer };
