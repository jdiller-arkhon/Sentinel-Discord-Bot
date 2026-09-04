import { getActiveLicenses, hasPosted, markPosted } from './db.js';
import { listPendingProposals } from './sentinelApi.js';
import { postChannelMessage } from './discordApi.js';
import { proposalEmbed, proposalComponents } from './embeds.js';

export async function pollAllLicenses(env) {
  const licenses = await getActiveLicenses(env.DB);

  await Promise.allSettled(
    licenses.map(async (license) => {
      try {
        const proposals = await listPendingProposals(license.sentinel_base_url);
        for (const proposal of proposals) {
          if (await hasPosted(env.DB, license.license_key, proposal.id)) continue;
          const message = await postChannelMessage(license.discord_bot_token, license.discord_channel_id, {
            embeds: [proposalEmbed(proposal)],
            components: proposalComponents(proposal.id),
          });
          await markPosted(env.DB, license.license_key, proposal.id, message.id);
        }
      } catch (err) {
        console.error(`[poll:${license.license_key}]`, err.message);
      }
    }),
  );
}
