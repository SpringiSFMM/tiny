const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const moment = require('moment-timezone');
const fs = require('fs');
const path = require('path');

// Configuration
const NOTIFICATION_CHANNEL_ID = process.env.MINECRAFT_NOTIFICATION_CHANNEL || '1307038573567934615';
const PING_ROLES = process.env.MINECRAFT_PING_ROLES ? process.env.MINECRAFT_PING_ROLES.split(',') : [];
const USER_DATA_PATH = path.join(__dirname, '../data/minecraft-users.json');

// Ensure data directory exists
function ensureDataDirectory() {
  const dirPath = path.dirname(USER_DATA_PATH);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Load user data
function loadUserData() {
  ensureDataDirectory();
  try {
    if (fs.existsSync(USER_DATA_PATH)) {
      return JSON.parse(fs.readFileSync(USER_DATA_PATH, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading user data:', error);
  }
  return {};
}

// Save user data
function saveUserData(data) {
  try {
    ensureDataDirectory();
    fs.writeFileSync(USER_DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving user data:', error);
    return false;
  }
}

// Format timezone for display
function formatTimezone(timezone) {
  return timezone.split('/').pop().replace('_', ' ');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('minecraft-user')
    .setDescription('Set your Minecraft user information')
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Set your Minecraft information')
        .addStringOption(option =>
          option.setName('username')
            .setDescription('Your Minecraft username')
            .setRequired(true))
        .addRoleOption(option =>
          option.setName('rank')
            .setDescription('Your rank on the Minecraft server')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('timezone')
            .setDescription('Your timezone')
            .setRequired(true)
            .addChoices(
              { name: 'Berlin (CET/CEST)', value: 'Europe/Berlin' },
              { name: 'London (GMT/BST)', value: 'Europe/London' },
              { name: 'New York (EST/EDT)', value: 'America/New_York' },
              { name: 'Los Angeles (PST/PDT)', value: 'America/Los_Angeles' },
              { name: 'Tokyo (JST)', value: 'Asia/Tokyo' },
              { name: 'Sydney (AEST/AEDT)', value: 'Australia/Sydney' }
            ))),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === 'set') {
      const username = interaction.options.getString('username');
      const rank = interaction.options.getRole('rank');
      const timezone = interaction.options.getString('timezone');
      
      // Load existing data
      const userData = loadUserData();
      const userId = interaction.user.id;
      
      // Update user data
      userData[userId] = {
        username,
        rank: rank.name,
        rankId: rank.id,
        timezone,
        updatedAt: new Date().toISOString()
      };
      
      // Save data
      if (saveUserData(userData)) {
        // Create notification embed
        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('🎮 New Minecraft User')
          .setDescription(`<@${userId}> has updated their Minecraft information`)
          .addFields(
            { name: 'Username', value: username, inline: true },
            { name: 'Rank', value: rank.toString(), inline: true },
            { name: 'Timezone', value: formatTimezone(timezone), inline: true },
            { name: 'Updated', value: `<t:${Math.floor(Date.now()/1000)}:R>`, inline: false }
          )
          .setThumbnail(interaction.user.displayAvatarURL())
          .setFooter({ text: 'Minecraft User Update' })
          .setTimestamp();
        
        // Send notification
        try {
          const channel = await interaction.guild.channels.fetch(NOTIFICATION_CHANNEL_ID);
          if (channel) {
            // Create ping string for roles
            const pingRoles = PING_ROLES
              .map(roleId => `<@&${roleId}>`)
              .join(' ');
            
            await channel.send({
              content: pingRoles || undefined,
              embeds: [embed]
            });
          }
        } catch (error) {
          console.error('Error sending notification:', error);
        }
        
        await interaction.editReply({
          content: '✅ Your Minecraft information has been updated!',
          ephemeral: true
        });
      } else {
        await interaction.editReply({
          content: '❌ There was an error saving your information. Please try again later.',
          ephemeral: true
        });
      }
    }
  }
};
