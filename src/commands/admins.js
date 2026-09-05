const { SlashCommandBuilder } = require("discord.js");
const { isAdmin } = require("../authz");
const { infoEmbed } = require("../embeds");
const admins = require("../admins");
const config = require("../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("admins")
    .setDescription("[admin] Manage who can run admin commands")
    .addStringOption((opt) =>
      opt
        .setName("action")
        .setDescription("add, remove, or list")
        .setRequired(true)
        .addChoices({ name: "add", value: "add" }, { name: "remove", value: "remove" }, { name: "list", value: "list" })
    )
    .addUserOption((opt) => opt.setName("user").setDescription("The Discord account (for add/remove)").setRequired(false)),

  async execute(interaction) {
    if (!isAdmin(interaction.user.id)) {
      return interaction.reply({ embeds: [infoEmbed({ title: "Not authorized", color: 0xed4245 })], ephemeral: true });
    }

    const action = interaction.options.getString("action", true);
    const target = interaction.options.getUser("user", false);

    if (action === "list") {
      const seedList = [...config.adminUserIds].map((id) => `<@${id}> _(from .env, requires a restart to remove)_`);
      const runtimeList = admins.listRuntimeAdmins().map((a) => `<@${a.discord_user_id}> (added ${new Date(a.added_at).toLocaleDateString()})`);
      const description = [...seedList, ...runtimeList].join("\n") || "No admins configured.";
      return interaction.reply({ embeds: [infoEmbed({ title: "Admins", description })], ephemeral: true });
    }

    if (!target) {
      return interaction.reply({
        embeds: [infoEmbed({ title: "Missing user", description: "The `user` option is required for add/remove.", color: 0xed4245 })],
        ephemeral: true,
      });
    }

    if (action === "add") {
      if (admins.isSeedAdmin(target.id)) {
        return interaction.reply({ embeds: [infoEmbed({ title: "Already an admin", description: "Already an admin via .env." })], ephemeral: true });
      }
      admins.add(target.id, interaction.user.id);
      return interaction.reply({
        embeds: [infoEmbed({ title: "Admin added", description: `<@${target.id}> can now run admin commands.`, color: 0x2ecc71 })],
        ephemeral: true,
      });
    }

    // remove
    if (admins.isSeedAdmin(target.id)) {
      return interaction.reply({
        embeds: [
          infoEmbed({
            title: "Can't remove",
            description: `<@${target.id}> is an admin via the .env \`ADMIN_USER_IDS\` list — edit that and restart the bot to remove them.`,
            color: 0xed4245,
          }),
        ],
        ephemeral: true,
      });
    }
    admins.remove(target.id);
    await interaction.reply({
      embeds: [infoEmbed({ title: "Admin removed", description: `<@${target.id}> can no longer run admin commands.`, color: 0x8a8f98 })],
      ephemeral: true,
    });
  },
};
