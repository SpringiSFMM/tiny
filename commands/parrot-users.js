const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Der Hauptbenutzer, der das Feature verwalten darf
const ADMIN_USER_ID = '563877348173414454';

// Pfad zur Datei, in der die erlaubten Benutzer gespeichert werden
const allowedUsersPath = path.join(__dirname, '..', 'data', 'parrotAllowedUsers.json');

// Funktion zum Laden der erlaubten Benutzer
function loadAllowedUsers() {
  try {
    // Stelle sicher, dass das Verzeichnis existiert
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    if (fs.existsSync(allowedUsersPath)) {
      const data = fs.readFileSync(allowedUsersPath, 'utf8');
      const users = JSON.parse(data);
      console.log(`Loaded ${users.length} allowed users for parrot feature`);
      return users;
    }
  } catch (error) {
    console.error(`Error loading allowed users: ${error.message}`);
  }
  
  // Standardwert: Nur der Admin-Benutzer
  const defaultUsers = [ADMIN_USER_ID];
  saveAllowedUsers(defaultUsers);
  return defaultUsers;
}

// Funktion zum Speichern der erlaubten Benutzer
function saveAllowedUsers(users) {
  try {
    fs.writeFileSync(allowedUsersPath, JSON.stringify(users, null, 2), 'utf8');
    console.log(`Saved ${users.length} allowed users for parrot feature`);
    return true;
  } catch (error) {
    console.error(`Error saving allowed users: ${error.message}`);
    return false;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('parrot')
    .setDescription('Verwaltet Benutzer für die Papageien-GIF-Funktion')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Fügt einen Benutzer zur Papageien-GIF-Liste hinzu')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('Der Benutzer, der GIFs auslösen soll')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Entfernt einen Benutzer von der Papageien-GIF-Liste')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('Der zu entfernende Benutzer')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Zeigt alle Benutzer an, die Papageien-GIFs auslösen können')),
  
  async execute(interaction) {
    // Nur der Admin-Benutzer darf diesen Befehl verwenden
    if (interaction.user.id !== ADMIN_USER_ID) {
      return interaction.reply({
        content: '❌ Du bist nicht berechtigt, diesen Befehl zu verwenden.',
        ephemeral: true
      });
    }

    // Lade die Liste der erlaubten Benutzer
    let allowedUserIds = loadAllowedUsers();
    
    // Bestimme, welcher Unterbefehl ausgeführt wurde
    const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === 'add') {
      // Benutzer hinzufügen
      const user = interaction.options.getUser('user');
      
      if (allowedUserIds.includes(user.id)) {
        return interaction.reply({
          content: `Der Benutzer ${user.username} ist bereits in der Liste.`,
          ephemeral: true
        });
      }
      
      allowedUserIds.push(user.id);
      saveAllowedUsers(allowedUserIds);
      
      return interaction.reply({
        content: `✅ Der Benutzer ${user.username} kann jetzt Papageien-GIFs auslösen.`,
        ephemeral: false
      });
      
    } else if (subcommand === 'remove') {
      // Benutzer entfernen
      const user = interaction.options.getUser('user');
      
      // Verhindere, dass der Admin entfernt wird
      if (user.id === ADMIN_USER_ID) {
        return interaction.reply({
          content: '❌ Der Admin-Benutzer kann nicht entfernt werden.',
          ephemeral: true
        });
      }
      
      if (!allowedUserIds.includes(user.id)) {
        return interaction.reply({
          content: `Der Benutzer ${user.username} ist nicht in der Liste.`,
          ephemeral: true
        });
      }
      
      allowedUserIds = allowedUserIds.filter(id => id !== user.id);
      saveAllowedUsers(allowedUserIds);
      
      return interaction.reply({
        content: `✅ Der Benutzer ${user.username} wurde aus der Liste entfernt.`,
        ephemeral: false
      });
      
    } else if (subcommand === 'list') {
      // Benutzer auflisten
      let userList = '';
      
      // Für jeden Benutzer in der Liste
      if (allowedUserIds.length === 0) {
        userList = 'Keine Benutzer in der Liste.';
      } else {
        for (const userId of allowedUserIds) {
          try {
            const user = await interaction.client.users.fetch(userId);
            userList += `- ${user.username} (${userId})${userId === ADMIN_USER_ID ? ' (Admin)' : ''}\n`;
          } catch (error) {
            userList += `- Unbekannter Benutzer (${userId})\n`;
          }
        }
      }
      
      return interaction.reply({
        content: `**Benutzer, die Papageien-GIFs auslösen können:**\n${userList}`,
        ephemeral: true
      });
    }
  }
};
