const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

// Discord's hard limits (as of the current API) — exceeding any of these
// makes the whole message create/edit call fail with a 400, silently
// dropping the entire proposal post rather than just that one field.
const FIELD_VALUE_LIMIT = 1024;
const DESCRIPTION_LIMIT = 4096;
const TITLE_LIMIT = 256;
const FOOTER_LIMIT = 2048;

const BRAND = "Sentinel AI Advisor";

function truncate(str, max) {
  if (str === null || str === undefined) return str;
  const s = String(str);
  if (s.length <= max) return s;
  const suffix = "\n…(truncated)";
  return s.slice(0, max - suffix.length) + suffix;
}

const STRATEGY_META = {
  momentum: { label: "Momentum", emoji: "📈" },
  mean_reversion: { label: "Mean-Reversion", emoji: "🔄" },
  new: { label: "New Strategy", emoji: "💡" },
};

const STATUS_META = {
  pending: { label: "Pending review", emoji: "🟡", color: 0xf5a623 },
  approved: { label: "Approved", emoji: "✅", color: 0x2ecc71 },
  rejected: { label: "Rejected", emoji: "⛔", color: 0x8a8f98 },
};

/** A 10-segment text progress bar, e.g. "▰▰▰▰▰▰▰▱▱▱ 68%" — reads at a
 * glance without needing an external image. */
function confidenceBar(pct) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const filled = Math.round(clamped / 10);
  return `${"▰".repeat(filled)}${"▱".repeat(10 - filled)}  **${clamped}%**`;
}

function formatParamsTable(params) {
  const entries = Object.entries(params || {});
  if (entries.length === 0) return "_(no params)_";
  const width = Math.max(...entries.map(([k]) => k.length));
  const rows = entries.map(([k, v]) => `${k.padEnd(width)} = ${v}`);
  return `\`\`\`\n${rows.join("\n")}\n\`\`\``;
}

function proposalEmbed(proposal) {
  const strategy = STRATEGY_META[proposal.target_strategy] ?? { label: proposal.target_strategy ?? "Unknown", emoji: "❔" };
  const status = STATUS_META[proposal.status] ?? { label: proposal.status, emoji: "⚪", color: 0x8a8f98 };

  const title = truncate(
    proposal.proposal_type === "parameter_tweak" ? `${strategy.emoji} ${strategy.label} Parameter Tweak` : "💡 New Strategy Idea",
    TITLE_LIMIT
  );

  const fields = [];

  if (proposal.proposal_type === "parameter_tweak") {
    const paramsTable = formatParamsTable(proposal.proposed_params);
    // The code-block fences count toward the 1024-char field limit too,
    // so truncate on the fully-rendered table, not the raw entries.
    fields.push({ name: "⚙️ Proposed Parameters", value: truncate(paramsTable, FIELD_VALUE_LIMIT) });
  } else if (proposal.new_strategy_description) {
    fields.push({ name: "💭 The Idea", value: truncate(proposal.new_strategy_description, FIELD_VALUE_LIMIT) });
  }

  fields.push({ name: "🧠 Rationale", value: truncate(proposal.rationale || "_(none given)_", FIELD_VALUE_LIMIT) });

  if (proposal.estimated_impact) {
    fields.push({
      name: "📊 Estimated Impact",
      value: truncate(`${proposal.estimated_impact}\n-# A guess, not a backtest result.`, FIELD_VALUE_LIMIT),
    });
  }

  fields.push({ name: "🎯 Confidence", value: confidenceBar(proposal.confidence), inline: true });
  fields.push({ name: "Status", value: `${status.emoji} ${status.label}`, inline: true });

  const embed = new EmbedBuilder()
    .setAuthor({ name: BRAND })
    .setTitle(title)
    .addFields(fields)
    .setColor(status.color)
    .setFooter({ text: truncate(`Proposal #${proposal.id.slice(0, 8)}`, FOOTER_LIMIT) })
    .setTimestamp(new Date(proposal.created_at));

  return embed;
}

function proposalActionRow(proposalId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`approve:${proposalId}`).setLabel("Approve").setEmoji("✅").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`reject:${proposalId}`).setLabel("Reject").setEmoji("⛔").setStyle(ButtonStyle.Danger)
  );
}

/** Shared look for every non-proposal reply (status/history/audit/clients/
 * help) so the whole bot reads as one consistent product instead of a mix
 * of plain text and rich embeds. */
function infoEmbed({ title, description, fields, color = 0x5865f2 }) {
  const embed = new EmbedBuilder().setAuthor({ name: BRAND }).setColor(color);
  if (title) embed.setTitle(truncate(title, TITLE_LIMIT));
  if (description) embed.setDescription(truncate(description, DESCRIPTION_LIMIT));
  if (fields?.length) embed.addFields(fields.map((f) => ({ ...f, value: truncate(f.value, FIELD_VALUE_LIMIT) })));
  return embed;
}

module.exports = {
  proposalEmbed,
  proposalActionRow,
  infoEmbed,
  truncate,
  confidenceBar,
  STRATEGY_META,
  STATUS_META,
  FIELD_VALUE_LIMIT,
  DESCRIPTION_LIMIT,
  TITLE_LIMIT,
};
