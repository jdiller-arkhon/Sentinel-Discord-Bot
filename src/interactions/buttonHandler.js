const db = require("../db");
const { SentinelClient, SentinelApiError } = require("../sentinelClient");
const { recordAudit } = require("../audit");
const { isOwnerOrAdmin } = require("../authz");
const { infoEmbed } = require("../embeds");

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

  if (!isOwnerOrAdmin(customer, interaction.user.id)) {
    return interaction.reply({ content: "Only the client this channel belongs to can do that.", ephemeral: true });
  }

  await interaction.deferUpdate();

  const sentinel = new SentinelClient({ baseUrl: customer.sentinel_base_url, token: customer.sentinel_token });

  try {
    let resultTitle, resultDescription, color;
    if (action === "approve") {
      const { applied } = await sentinel.approveProposal(proposalId);
      resultTitle = "✅ Approved";
      resultDescription = applied ? "Applied through Sentinel's audited path." : "Acknowledged — no automatic change exists for this yet.";
      color = 0x2ecc71;
    } else {
      await sentinel.rejectProposal(proposalId);
      resultTitle = "⛔ Rejected";
      resultDescription = "No change was made.";
      color = 0x8a8f98;
    }

    recordAudit({
      customerId: customer.id,
      proposalId,
      action,
      discordUserId: interaction.user.id,
      discordUsername: interaction.user.tag,
      result: "ok",
    });

    const resultEmbed = infoEmbed({
      title: resultTitle,
      description: `${resultDescription}\n\n-# by ${interaction.user.tag}`,
      color,
    });
    // Keep the original proposal card intact and stack the outcome below
    // it, rather than replacing the card the reviewer was looking at.
    await interaction.editReply({
      embeds: [...interaction.message.embeds, resultEmbed],
      components: disableRow(interaction.message.components),
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
      const resultEmbed = infoEmbed({
        title: isAlreadyReviewed ? "Already reviewed" : "No longer exists",
        description: isAlreadyReviewed
          ? `Someone already reviewed this proposal (${err.detail || "already reviewed"}).`
          : "This proposal no longer exists on Sentinel.",
        color: 0x8a8f98,
      });
      await interaction.editReply({
        embeds: [...interaction.message.embeds, resultEmbed],
        components: disableRow(interaction.message.components),
      });
    } else {
      await interaction.followUp({
        embeds: [
          infoEmbed({
            title: "Failed",
            description: `Sentinel didn't respond after retries. Try again shortly.\n\`${err.message}\``,
            color: 0xed4245,
          }),
        ],
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
