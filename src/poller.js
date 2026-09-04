import { proposalEmbed, proposalButtons } from './embeds.js';

export function startPolling({ client, channelId, pollIntervalSeconds, sentinelClient, store, log = console }) {
  const poll = async () => {
    try {
      const proposals = await sentinelClient.listPendingProposals();
      const channel = await client.channels.fetch(channelId);
      for (const proposal of proposals) {
        if (store.hasPosted(proposal.id)) continue;
        const message = await channel.send({
          embeds: [proposalEmbed(proposal)],
          components: [proposalButtons(proposal.id)],
        });
        store.markPosted(proposal.id, message.id);
      }
    } catch (err) {
      log.error('Poll failed:', err.message);
    }
  };

  poll();
  const timer = setInterval(poll, pollIntervalSeconds * 1000);
  return () => clearInterval(timer);
}
