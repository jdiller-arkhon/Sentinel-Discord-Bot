const db = require("../db");
const config = require("../config");
const { SentinelClient, SentinelApiError } = require("../sentinelClient");
const { recordAudit } = require("../audit");

const getByChannel = db.prepare("SELECT * FROM customers WHERE channel_id = ?");

/**
 * Handles an approve:<id> / reject:<id> button click. The proposal id
 * comes from the button's own custom_id (set by us when we posted it —
 * never from user-supplied text), and which Sentinel instance to call is
 * resolved from the channel the click happened in, never from anything
 * embedded in the interaction payload that a user could tamper with.
 */
async function handleButton(interaction) {
  const [action, proposalId] = interaction.customId.split(":");
  if (action !== "approve" && action !== "reject") return;

  const customer = getByChannel.get(interaction.channelId);
  if (!customer) {
    return interaction.reply({ content: "This channel isn't linked to a Sentinel instance anymore.", ephemeral: true });
  }

  const isOwner = interaction.user.id === customer.discord_user_id;
  const isAdmin = config.adminUserIds.has(interaction.user.id);
  if (!isOwner && !isAdmin) {
    return interaction.reply({ content: "Only the client this channel belongs to can do that.", ephemeral: true });
  }

  await interaction.deferUpdate();

  const sentinel = new SentinelClient({ baseUrl: customer.sentinel_base_url, token: customer.sentinel_token });

  try {
    let resultText;
    if (action === "approve") {
      const { applied } = await sentinel.approveProposal(proposalId);
      resultText = applied
        ? "✅ Approved and applied."
        : "✅ Approved (acknowledged only — no automatic change exists for this yet).";
    } else {
      await sentinel.rejectProposal(proposalId);
      resultText = "❌ Rejected.";
    }

    recordAudit({
      customerId: customer.id,
      proposalId,
      action,
      discordUserId: interaction.user.id,
      discordUsername: interaction.user.tag,
      result: "ok",
    });

    const disabledRow = disableRow(interaction.message.components);
    await interaction.editReply({
      content: `${resultText} (by ${interaction.user.tag})`,
      components: disabledRow,
    });
  } catch (err) {
    const isAlreadyReviewed = err instanceof SentinelApiError && err.status === 400;
    const isNotFound = err instanceof SentinelApiError && err.status === 404;

    recordAudit({
      customerId: customer.id,
      proposalId,
      action,
      discordUserId: interaction.user.id,
      discordUsername: interaction.user.tag,
      result: `error:${err.message}`,
    });

    if (isAlreadyReviewed || isNotFound) {
      // Backstop for a double-click race — Sentinel's own 400 is the
      // source of truth, we just render it gracefully instead of raw.
      await interaction.editReply({
        content: isAlreadyReviewed
          ? `Someone already reviewed this proposal (${err.detail || "already reviewed"}).`
          : "This proposal no longer exists on Sentinel.",
        components: disableRow(interaction.message.components),
      });
    } else {
      await interaction.followUp({
        content: `Failed to ${action} — Sentinel didn't respond after retries. Try again shortly. (\`${err.message}\`)`,
        ephemeral: true,
      });
    }
  }
}

function disableRow(components) {
  return components.map((row) => ({
    type: row.type,
    components: row.components.map((c) => ({ ...c.data, disabled: true })),
  }));
}

module.exports = { handleButton };
