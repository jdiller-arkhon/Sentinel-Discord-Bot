const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { hasPermission } = require("../authz");
const { infoEmbed } = require("../embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Bulk-delete recent messages in this channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((opt) => opt.setName("amount").setDescription("How many messages (1-100)").setMinValue(1).setMaxValue(100).setRequired(true))
    .addUserOption((opt) => opt.setName("user").setDescription("Only delete this user's messages").setRequired(false)),

  async execute(interaction) {
    if (!hasPermission(interaction, PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({ embeds: [infoEmbed({ title: "Not authorized", description: "Requires Manage Messages.", color: 0xed4245 })], ephemeral: true });
    }

    const amount = interaction.options.getInteger("amount", true);
    const targetUser = interaction.options.getUser("user", false);

    await interaction.deferReply({ ephemeral: true });

    // Discord's bulk-delete endpoint only touches messages under 14 days
    // old and caps at 100 per call — fetch a bit extra when filtering by
    // user so "amount" means "N of theirs deleted," not "N scanned."
    const fetchCount = targetUser ? Math.min(100, amount * 3) : amount;
    const messages = await interaction.channel.messages.fetch({ limit: fetchCount });
    const toDelete = targetUser
      ? [...messages.filter((m) => m.author.id === targetUser.id).values()].slice(0, amount)
      : [...messages.values()].slice(0, amount);

    if (toDelete.length === 0) {
      return interaction.editReply({ embeds: [infoEmbed({ title: "Nothing to delete", description: "No matching messages found." })] });
    }

    const deleted = await interaction.channel.bulkDelete(toDelete, true);

    await interaction.editReply({
      embeds: [
        infoEmbed({
          title: "🧹 Purged",
          description: `Deleted ${deleted.size} message(s)${targetUser ? ` from ${targetUser}` : ""}.` +
            (deleted.size < toDelete.length ? "\n_(some were older than 14 days and Discord won't bulk-delete those)_" : ""),
          color: 0x2ecc71,
        }),
      ],
    });
  },
};
