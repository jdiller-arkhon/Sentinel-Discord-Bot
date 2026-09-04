import { SentinelApiError } from './sentinelClient.js';
import { proposalEmbed, proposalButtons } from './embeds.js';

function resultLine(action, allowedUserId, response) {
  if (action === 'reject') return `❌ Rejected by <@${allowedUserId}>.`;
  const { applied } = response;
  return applied
    ? `✅ Approved by <@${allowedUserId}> — change applied to live parameters.`
    : `✅ Approved by <@${allowedUserId}> — acknowledged only, no automatic change exists for this proposal type yet.`;
}

export function createInteractionHandler({ allowedUserId, sentinelClient, log = console }) {
  return async function handleInteraction(interaction) {
    if (!interaction.isButton()) return;

    const [action, proposalId] = interaction.customId.split(':');
    if (action !== 'approve' && action !== 'reject') return;

    const invokerId = interaction.member?.user?.id ?? interaction.user?.id;
    if (invokerId !== allowedUserId) {
      await interaction.reply({ content: 'You are not authorized to review Sentinel proposals.', ephemeral: true });
      return;
    }

    await interaction.deferUpdate();

    try {
      const response = action === 'approve' ? await sentinelClient.approveProposal(proposalId) : await sentinelClient.rejectProposal(proposalId);
      const proposal = response.proposal;
      await interaction.editReply({
        embeds: [proposalEmbed(proposal)],
        components: [proposalButtons(proposalId, true)],
        content: resultLine(action, allowedUserId, response),
      });
    } catch (err) {
      if (err instanceof SentinelApiError && (err.status === 400 || err.status === 404)) {
        await interaction.editReply({
          components: [proposalButtons(proposalId, true)],
          content: `⚠️ Could not ${action} — ${err.detail || 'this proposal was likely already reviewed or no longer exists.'}`,
        });
        return;
      }
      log.error(`Failed to ${action} proposal ${proposalId}:`, err);
      await interaction.followUp({
        content: `⚠️ Failed to ${action} proposal: ${err.message}`,
        ephemeral: true,
      });
    }
  };
}
