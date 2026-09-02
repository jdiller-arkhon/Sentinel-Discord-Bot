import { config } from './config.js';
import { approveProposal, rejectProposal, SentinelApiError } from './sentinelClient.js';
import { proposalEmbed, proposalButtons } from './embeds.js';

function resultLine(action, response) {
  if (action === 'reject') return `❌ Rejected by <@${config.discordAllowedUserId}>.`;
  const { applied } = response;
  return applied
    ? `✅ Approved by <@${config.discordAllowedUserId}> — change applied to live parameters.`
    : `✅ Approved by <@${config.discordAllowedUserId}> — acknowledged only, no automatic change exists for this proposal type yet.`;
}

export async function handleInteraction(interaction) {
  if (!interaction.isButton()) return;

  const [action, proposalId] = interaction.customId.split(':');
  if (action !== 'approve' && action !== 'reject') return;

  const invokerId = interaction.member?.user?.id ?? interaction.user?.id;
  if (invokerId !== config.discordAllowedUserId) {
    await interaction.reply({ content: 'You are not authorized to review Sentinel proposals.', ephemeral: true });
    return;
  }

  await interaction.deferUpdate();

  try {
    const response = action === 'approve' ? await approveProposal(proposalId) : await rejectProposal(proposalId);
    const proposal = response.proposal;
    await interaction.editReply({
      embeds: [proposalEmbed(proposal)],
      components: [proposalButtons(proposalId, true)],
      content: resultLine(action, response),
    });
  } catch (err) {
    if (err instanceof SentinelApiError && (err.status === 400 || err.status === 404)) {
      await interaction.editReply({
        components: [proposalButtons(proposalId, true)],
        content: `⚠️ Could not ${action} — ${err.detail || 'this proposal was likely already reviewed or no longer exists.'}`,
      });
      return;
    }
    console.error(`Failed to ${action} proposal ${proposalId}:`, err);
    await interaction.followUp({
      content: `⚠️ Failed to ${action} proposal: ${err.message}`,
      ephemeral: true,
    });
  }
}
