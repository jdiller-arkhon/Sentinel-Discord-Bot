import {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { createLicense, listLicenses, revokeLicense } from './licenseStore.js';

const CREATE_MODAL_ID = 'sentinel-license-create';

export const commandDefinitions = [
  new SlashCommandBuilder()
    .setName('license')
    .setDescription('Manage sub-bot licenses for Sentinel customers')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) => sub.setName('create').setDescription('Create a new customer license (opens a form)'))
    .addSubcommand((sub) =>
      sub
        .setName('revoke')
        .setDescription('Revoke a customer license')
        .addStringOption((opt) => opt.setName('key').setDescription('License key, e.g. SENT-XXXX-XXXX-XXXX-XXXX').setRequired(true)),
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List all customer licenses'))
    .toJSON(),
];

function mask(token) {
  if (!token) return '';
  return token.length <= 8 ? '****' : `${token.slice(0, 4)}...${token.slice(-4)}`;
}

function buildCreateModal() {
  const modal = new ModalBuilder().setCustomId(CREATE_MODAL_ID).setTitle('New Sentinel customer license');

  const fields = [
    { id: 'customerName', label: 'Customer name', style: TextInputStyle.Short, required: true },
    { id: 'discordBotToken', label: "Customer's Discord bot token", style: TextInputStyle.Short, required: true },
    { id: 'discordChannelId', label: 'Discord channel id (proposals go here)', style: TextInputStyle.Short, required: true },
    { id: 'discordAllowedUserId', label: 'Discord user id allowed to approve/reject', style: TextInputStyle.Short, required: true },
    { id: 'sentinelBaseUrl', label: 'Sentinel base URL', style: TextInputStyle.Short, required: false },
  ];

  for (const field of fields) {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(field.id)
          .setLabel(field.label)
          .setStyle(field.style)
          .setRequired(field.required),
      ),
    );
  }

  return modal;
}

function isAdmin(interaction, adminUserId) {
  const invokerId = interaction.member?.user?.id ?? interaction.user?.id;
  return invokerId === adminUserId;
}

export function createAdminInteractionHandler({ adminUserId, log = console }) {
  return async function handleAdminInteraction(interaction) {
    if (interaction.isChatInputCommand() && interaction.commandName === 'license') {
      if (!isAdmin(interaction, adminUserId)) {
        await interaction.reply({ content: 'You are not authorized to manage licenses.', ephemeral: true });
        return;
      }

      const sub = interaction.options.getSubcommand();

      if (sub === 'create') {
        await interaction.showModal(buildCreateModal());
        return;
      }

      if (sub === 'revoke') {
        const key = interaction.options.getString('key', true);
        const entry = revokeLicense(key);
        if (!entry) {
          await interaction.reply({ content: `No license found with key \`${key}\`.`, ephemeral: true });
          return;
        }
        await interaction.reply({
          content: `Revoked license \`${entry.licenseKey}\` (${entry.customerName}). The manager will stop this bot within ~30s.`,
          ephemeral: true,
        });
        return;
      }

      if (sub === 'list') {
        const licenses = listLicenses();
        if (licenses.length === 0) {
          await interaction.reply({ content: 'No licenses yet. Use `/license create`.', ephemeral: true });
          return;
        }
        const lines = licenses.map(
          (l) =>
            `${l.revoked ? '🔴' : '🟢'} \`${l.licenseKey}\` — ${l.customerName} (channel ${l.discordChannelId}, user ${l.discordAllowedUserId}, token ${mask(l.discordBotToken)})`,
        );
        await interaction.reply({ content: lines.join('\n'), ephemeral: true });
        return;
      }
    }

    if (interaction.isModalSubmit() && interaction.customId === CREATE_MODAL_ID) {
      if (!isAdmin(interaction, adminUserId)) {
        await interaction.reply({ content: 'You are not authorized to manage licenses.', ephemeral: true });
        return;
      }

      const customerName = interaction.fields.getTextInputValue('customerName').trim();
      const discordBotToken = interaction.fields.getTextInputValue('discordBotToken').trim();
      const discordChannelId = interaction.fields.getTextInputValue('discordChannelId').trim();
      const discordAllowedUserId = interaction.fields.getTextInputValue('discordAllowedUserId').trim();
      const sentinelBaseUrl = interaction.fields.getTextInputValue('sentinelBaseUrl').trim() || 'http://127.0.0.1:8765';

      try {
        const entry = createLicense({
          customerName,
          discordBotToken,
          discordChannelId,
          discordAllowedUserId,
          sentinelBaseUrl,
        });
        await interaction.reply({
          content: `License created for **${entry.customerName}**: \`${entry.licenseKey}\`\nThe manager will start this bot within ~30s.`,
          ephemeral: true,
        });
      } catch (err) {
        log.error('Failed to create license from modal:', err);
        await interaction.reply({ content: `Failed to create license: ${err.message}`, ephemeral: true });
      }
    }
  };
}

export async function registerAdminCommands(client, guildId) {
  const target = guildId ? await client.guilds.fetch(guildId) : client.application;
  await target.commands.set(commandDefinitions);
}
