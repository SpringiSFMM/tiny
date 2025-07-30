const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');
const axios = require('axios');
require('dotenv').config();

// Data storage location - must match the path in minecraft-user.js
const DATA_PATH = path.join(__dirname, '../data/minecraft-users.json');

// Ensures that the data directory exists
function ensureDataDirectory() {
  const dirPath = path.dirname(DATA_PATH);
  if (!fs.existsSync(dirPath)) {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`Data directory created: ${dirPath}`);
    } catch (error) {
      console.error(`Error creating data directory: ${error}`);
    }
  }
}

// Helper function to load user data
function loadUserData() {
  ensureDataDirectory();
  try {
    if (fs.existsSync(DATA_PATH)) {
      return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    }
    // If the file doesn't exist, return an empty object
    return {};
  } catch (error) {
    console.error('Error loading user data:', error);
    return {};
  }
}

// Helper function to format the age of an account
function formatAccountAge(creationDate) {
  const now = moment();
  const creation = moment(creationDate);
  
  const years = now.diff(creation, 'years');
  const months = now.diff(creation, 'months') % 12;
  const days = now.diff(creation, 'days') % 30;
  
  let ageString = '';
  if (years > 0) ageString += `${years} year${years !== 1 ? 's' : ''} `;
  if (months > 0) ageString += `${months} month${months !== 1 ? 's' : ''} `;
  if (days > 0) ageString += `${days} day${days !== 1 ? 's' : ''}`;
  return ageString.trim() || 'less than a day';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('minecraft-info')
    .setDescription('Display Minecraft player information')
    .addStringOption(option =>
      option.setName('username')
        .setDescription('Minecraft username (Optional, if not provided your own data will be shown)')
        .setRequired(false)),
    
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    // Optional username parameter
    const requestedUsername = interaction.options.getString('username');
    
    // User ID of the requesting user
    const userId = interaction.user.id;
    
    // Load user data
    const userData = loadUserData();
    
    let username, timezone, accountCreationDate, rank, lastSeen;
    let isOwnProfile = true;
    
    // If a specific username was provided, we try to get information about this player
    if (requestedUsername) {
      isOwnProfile = false;
      
      // Check if we have this player in our data
      let foundUser = null;
      for (const [id, data] of Object.entries(userData)) {
        if (data.username && data.username.toLowerCase() === requestedUsername.toLowerCase()) {
          foundUser = data;
          break;
        }
      }
      
      if (foundUser) {
        // We have data for this player
        username = foundUser.username;
        timezone = foundUser.timezone;
        accountCreationDate = foundUser.accountCreationDate;
        rank = foundUser.rank || 'Not set';
        lastSeen = foundUser.lastSeen;
      } else {
        // No local data, try to get information from the Mojang API
        try {
          const response = await axios.get(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(requestedUsername)}`, {
            timeout: 5000
          });
          
          if (!response.data || !response.data.id) {
            return interaction.editReply({
              content: `❌ The Minecraft player **${requestedUsername}** does not exist.`,
              ephemeral: true
            });
          }
          
          username = response.data.name;
          const uuid = response.data.id;
          
          // Estimate the approximate creation date from the UUID
          let creationDate;
          
          // If the UUID has a specific format indicating old accounts
          if (uuid.length === 32 && !uuid.includes('-')) {
            if (parseInt(uuid.substring(12, 16), 16) < 2000) {
              // Very likely an old account (before 2014)
              creationDate = moment('2012-01-01');
            } else {
              // Newer account, but still a rough estimate
              creationDate = moment('2014-01-01');
            }
          } else {
            // Without better information we use a standard date
            creationDate = moment('2015-01-01');
          }
          
          accountCreationDate = creationDate.toISOString();
          rank = 'Unknown';
        } catch (error) {
          console.error('Error retrieving Minecraft profile data:', error);
          return interaction.editReply({
            content: `❌ There was an error retrieving information about **${requestedUsername}**. Please try again later.`,
            ephemeral: true
          });
        }
      }
    } else {
      // Display own profile
      // Check if the user has saved data
      if (!userData[userId]) {
        return interaction.editReply({
          content: 'ℹ️ You have not saved any Minecraft data yet. Use `/minecraft-user set` to set your username.',
          ephemeral: true
        });
      }
      
      const userInfo = userData[userId];
      username = userInfo.username;
      timezone = userInfo.timezone;
      accountCreationDate = userInfo.accountCreationDate;
      rank = userInfo.rank || 'Not set';
      lastSeen = userInfo.lastSeen;
    }
    
    // Create an embed for display
    const infoEmbed = new EmbedBuilder()
      .setColor(0x25AA7A)
      .setTitle(isOwnProfile ? 'Your Minecraft Information' : `Minecraft Information: ${username}`)
      .setThumbnail(`https://mc-heads.net/avatar/${encodeURIComponent(username || 'MHF_Question')}/100`)
      .addFields(
        { name: 'Username', value: username || 'Not set', inline: true },
        { name: 'Rank', value: rank, inline: true }
      );
    
    // Create the time field if a timezone is available
    if (timezone) {
      // Current Unix timestamp in the specified timezone
      const now = moment().tz(timezone);
      const unixTimestamp = Math.floor(now.valueOf() / 1000);
      
      // Format Discord timestamp
      const discordTimestamp = `<t:${unixTimestamp}:t>`;  // Short time (HH:MM)
      const discordFullTimestamp = `<t:${unixTimestamp}:F>`; // Full date + time
      
      infoEmbed.addFields(
        { name: 'Timezone', value: `${timezone}\nCurrent time: ${discordTimestamp}\nFull: ${discordFullTimestamp}`, inline: false }
      );
    } else {
      infoEmbed.addFields(
        { name: 'Timezone', value: 'Not set', inline: false }
      );
    }
    
    // Add account age if known
    if (accountCreationDate) {
      const creationDate = moment(accountCreationDate);
      const formattedDate = creationDate.format('MM/DD/YYYY');
      const ageString = formatAccountAge(accountCreationDate);
      
      infoEmbed.addFields(
        { name: 'Account created on', value: formattedDate, inline: true },
        { name: 'Account age', value: ageString, inline: true }
      );
    }
    
    // Additional information, if available
    if (lastSeen) {
      // Unix timestamp for lastSeen
      const lastSeenTimestamp = Math.floor(moment(lastSeen).valueOf() / 1000);
      
      // Discord timestamp for 'Last seen'
      const discordLastSeen = `<t:${lastSeenTimestamp}:F>`;  // Full date + time
      const discordRelative = `<t:${lastSeenTimestamp}:R>`;   // Relative time (e.g., "2 hours ago")
      
      infoEmbed.addFields(
        { name: 'Last seen', value: `${discordLastSeen}\n${discordRelative}`, inline: false }
      );
    }
    
    infoEmbed.setFooter({ text: isOwnProfile 
      ? 'Use /minecraft-user set to change your settings' 
      : 'More information might be available on the Minecraft server' 
    });
    
    return interaction.editReply({
      embeds: [infoEmbed],
      ephemeral: true
    });
  }
};
