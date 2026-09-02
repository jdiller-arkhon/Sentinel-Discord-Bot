import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export function proposalEmbed(proposal) {
  const embed = new EmbedBuilder()
    .setTitle('Sentinel AI Strategy Proposal')
    .setColor(0x5865f2)
    .addFields(
      { name: 'Type', value: proposal.proposal_type, inline: true },
      { name: 'Target strategy', value: proposal.target_strategy || 'n/a', inline: true },
      { name: 'Confidence', value: `${proposal.confidence}/100`, inline: true },
    )
    .setFooter({ text: `Proposal id: ${proposal.id}` })
    .setTimestamp(new Date(proposal.created_at));

  if (proposal.proposal_type === 'parameter_tweak' && proposal.proposed_params) {
    embed.addFields({
      name: 'Proposed params',
      value: '```json\n' + JSON.stringify(proposal.proposed_params, null, 2) + '\n```',
    });
  }

  if (proposal.proposal_type === 'new_strategy_idea' && proposal.new_strategy_description) {
    embed.addFields({ name: 'New strategy idea', value: proposal.new_strategy_description });
  }

  embed.addFields(
    { name: 'Rationale', value: proposal.rationale || 'n/a' },
    { name: 'Estimated impact', value: proposal.estimated_impact || 'n/a' },
  );

  return embed;
}

export function proposalButtons(proposalId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`approve:${proposalId}`)
      .setLabel('Approve')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`reject:${proposalId}`)
      .setLabel('Reject')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
  );
}
