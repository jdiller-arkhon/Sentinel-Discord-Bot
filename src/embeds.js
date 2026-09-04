const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

// Discord's hard limits (as of the current API) — exceeding any of these
// makes the whole message create/edit call fail with a 400, silently
// dropping the entire proposal post rather than just that one field.
const FIELD_VALUE_LIMIT = 1024;
const DESCRIPTION_LIMIT = 4096;
const TITLE_LIMIT = 256;

function truncate(str, max) {
  if (str === null || str === undefined) return str;
  const s = String(str);
  if (s.length <= max) return s;
  const suffix = "\n…(truncated)";
  return s.slice(0, max - suffix.length) + suffix;
}

const STRATEGY_LABELS = {
  momentum: "Momentum",
  mean_reversion: "Mean-Reversion",
  new: "New strategy",
};

function proposalEmbed(proposal) {
  const title = truncate(
    proposal.proposal_type === "parameter_tweak"
      ? `${STRATEGY_LABELS[proposal.target_strategy] ?? proposal.target_strategy} parameter tweak`
      : "New strategy idea",
    TITLE_LIMIT
  );

  const fields = [];

  if (proposal.proposal_type === "parameter_tweak") {
    const paramsText = Object.entries(proposal.proposed_params || {})
      .map(([k, v]) => `${k} = ${v}`)
      .join("\n") || "(no params)";
    fields.push({ name: "Proposed params", value: truncate(paramsText, FIELD_VALUE_LIMIT) });
  } else if (proposal.new_strategy_description) {
    fields.push({ name: "Idea", value: truncate(proposal.new_strategy_description, FIELD_VALUE_LIMIT) });
  }

  fields.push({ name: "Rationale", value: truncate(proposal.rationale || "(none given)", FIELD_VALUE_LIMIT) });

  if (proposal.estimated_impact) {
    fields.push({ name: "Estimated impact (a guess, not a backtest)", value: truncate(proposal.estimated_impact, FIELD_VALUE_LIMIT) });
  }

  fields.push({ name: "Confidence", value: `${proposal.confidence}%`, inline: true });
  fields.push({ name: "Status", value: proposal.status, inline: true });

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(truncate(`Proposal ID: \`${proposal.id}\``, DESCRIPTION_LIMIT))
    .addFields(fields)
    .setColor(proposal.status === "pending" ? 0xf1c40f : proposal.status === "approved" ? 0x2ecc71 : 0x95a5a6)
    .setTimestamp(new Date(proposal.created_at));

  return embed;
}

function proposalActionRow(proposalId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`approve:${proposalId}`).setLabel("Approve").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`reject:${proposalId}`).setLabel("Reject").setStyle(ButtonStyle.Danger)
  );
}

module.exports = { proposalEmbed, proposalActionRow, truncate, FIELD_VALUE_LIMIT, DESCRIPTION_LIMIT, TITLE_LIMIT };
