import { config } from './config.js';
import { listPendingProposals } from './sentinelClient.js';
import { hasPosted, markPosted } from './proposalStore.js';
import { proposalEmbed, proposalButtons } from './embeds.js';

export function startPolling(client) {
  const poll = async () => {
    try {
      const proposals = await listPendingProposals();
      const channel = await client.channels.fetch(config.discordChannelId);
      for (const proposal of proposals) {
        if (hasPosted(proposal.id)) continue;
        const message = await channel.send({
          embeds: [proposalEmbed(proposal)],
          components: [proposalButtons(proposal.id)],
        });
        markPosted(proposal.id, message.id);
      }
    } catch (err) {
      console.error('Poll failed:', err.message);
    }
  };

  poll();
  setInterval(poll, config.pollIntervalSeconds * 1000);
}
