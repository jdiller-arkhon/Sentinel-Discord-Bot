import { approveProposal, rejectProposal, SentinelApiError } from './sentinelApi.js';
import { editOriginalInteractionResponse } from './discordApi.js';
import { proposalEmbed, proposalComponents } from './embeds.js';

function resultLine(action, allowedUserId, response) {
  if (action === 'reject') return `❌ Rejected by <@${allowedUserId}>.`;
  const { applied } = response;
  return applied
    ? `✅ Approved by <@${allowedUserId}> — change applied to live parameters.`
    : `✅ Approved by <@${allowedUserId}> — acknowledged only, no automatic change exists for this proposal type yet.`;
}

// Called from a waitUntil() after the interaction has already been deferred (type 6),
// so it has up to 15 minutes (Discord's webhook token lifetime) rather than 3 seconds.
export async function resolveProposalAction({ action, proposalId, license, applicationId, interactionToken }) {
  try {
    const response =
      action === 'approve' ? await approveProposal(license.sentinel_base_url, proposalId) : await rejectProposal(license.sentinel_base_url, proposalId);
    await editOriginalInteractionResponse(applicationId, interactionToken, {
      embeds: [proposalEmbed(response.proposal)],
      components: proposalComponents(proposalId, true),
      content: resultLine(action, license.discord_allowed_user_id, response),
    });
  } catch (err) {
    if (err instanceof SentinelApiError && (err.status === 400 || err.status === 404)) {
      await editOriginalInteractionResponse(applicationId, interactionToken, {
        components: proposalComponents(proposalId, true),
        content: `⚠️ Could not ${action} — ${err.detail || 'this proposal was likely already reviewed or no longer exists.'}`,
      });
      return;
    }
    console.error(`Failed to ${action} proposal ${proposalId}:`, err);
    await editOriginalInteractionResponse(applicationId, interactionToken, {
      content: `⚠️ Failed to ${action} proposal: ${err.message}`,
    });
  }
}
