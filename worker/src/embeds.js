export function proposalEmbed(proposal) {
  const fields = [
    { name: 'Type', value: proposal.proposal_type, inline: true },
    { name: 'Target strategy', value: proposal.target_strategy || 'n/a', inline: true },
    { name: 'Confidence', value: `${proposal.confidence}/100`, inline: true },
  ];

  if (proposal.proposal_type === 'parameter_tweak' && proposal.proposed_params) {
    fields.push({
      name: 'Proposed params',
      value: '```json\n' + JSON.stringify(proposal.proposed_params, null, 2) + '\n```',
    });
  }

  if (proposal.proposal_type === 'new_strategy_idea' && proposal.new_strategy_description) {
    fields.push({ name: 'New strategy idea', value: proposal.new_strategy_description });
  }

  fields.push(
    { name: 'Rationale', value: proposal.rationale || 'n/a' },
    { name: 'Estimated impact', value: proposal.estimated_impact || 'n/a' },
  );

  return {
    title: 'Sentinel AI Strategy Proposal',
    color: 0x5865f2,
    fields,
    footer: { text: `Proposal id: ${proposal.id}` },
    timestamp: new Date(proposal.created_at).toISOString(),
  };
}

export function proposalComponents(proposalId, disabled = false) {
  return [
    {
      type: 1, // ACTION_ROW
      components: [
        {
          type: 2, // BUTTON
          style: 3, // SUCCESS
          label: 'Approve',
          custom_id: `approve:${proposalId}`,
          disabled,
        },
        {
          type: 2,
          style: 4, // DANGER
          label: 'Reject',
          custom_id: `reject:${proposalId}`,
          disabled,
        },
      ],
    },
  ];
}
