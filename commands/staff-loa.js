const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { storeLoaMessageId } = require('../utils/loa-sync-cjs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('staff-loa')
    .setDescription('Staff Leave of Absence management')
    .addSubcommand(subcommand =>
      subcommand
        .setName('request')
        .setDescription('Submit a new Leave of Absence request')
        .addStringOption(option => 
          option.setName('start-date')
            .setDescription('The start date of your leave (YYYY-MM-DD)')
            .setRequired(true))
        .addStringOption(option => 
          option.setName('end-date')
            .setDescription('The end date of your leave (YYYY-MM-DD)')
            .setRequired(true))
        .addStringOption(option => 
          option.setName('reason')
            .setDescription('The reason for your leave of absence')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('type')
            .setDescription('The type of absence')
            .setRequired(true)
            .addChoices(
              { name: 'Vacation', value: 'vacation' },
              { name: 'Personal', value: 'personal' },
              { name: 'Medical', value: 'medical' },
              { name: 'School/Work', value: 'school_work' },
              { name: 'Other', value: 'other' }
            ))
        .addBooleanOption(option =>
          option.setName('private')
            .setDescription('Make this LOA request private (only visible to admins)')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('extend')
        .setDescription('Extend your existing Leave of Absence')
        .addStringOption(option =>
          option.setName('loa-id')
            .setDescription('The ID of your current LOA to extend (e.g., LOA-XXXXXX)')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('new-end-date')
            .setDescription('The new end date for your leave (YYYY-MM-DD)')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('reason')
            .setDescription('The reason for extending your leave')
            .setRequired(true))),
  
  async execute(interaction) {
    // Identify which subcommand was used
    const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === 'request') {
      await handleRequestCommand(interaction);
    } else if (subcommand === 'extend') {
      await handleExtendCommand(interaction);
    }
  },
};

async function handleRequestCommand(interaction) {
  // Load the staff configuration
  const configPath = path.join(__dirname, '..', 'data', 'staff-config.json');
  let staffConfig = { staffRoleId: '', loaRoleId: '' };
  
  try {
    if (fs.existsSync(configPath)) {
      staffConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } else {
      console.warn('Staff config file not found, creating default');
      fs.writeFileSync(configPath, JSON.stringify(staffConfig, null, 2), 'utf8');
    }
  } catch (error) {
    console.error('Error loading staff config:', error);
  }
  
  // Check if the user has the staff role
  const staffRoleId = staffConfig.staffRoleId;
  
  // Add detailed logging for role checking
  console.log(`Checking staff role access for user: ${interaction.user.tag}`);
  console.log(`Configured staff role ID: ${staffRoleId || 'not configured'}`); 
  console.log(`User has the following roles:`);
  interaction.member.roles.cache.forEach(role => {
    console.log(`- ${role.name} (ID: ${role.id})`);
  });
  
  // Try multiple methods to check if user has staff permission
  let hasStaffRole = false;
  
  // Method 1: Check by configured role ID if available
  if (staffRoleId) {
    hasStaffRole = interaction.member.roles.cache.has(staffRoleId);
    console.log(`Method 1 - Checking by ID ${staffRoleId}: ${hasStaffRole}`);
  }
  
  // Method 2: Check by common staff role names as fallback
  if (!hasStaffRole) {
    const commonStaffRoleNames = ['Staff', 'Team', 'Admin', 'Moderator', 'Helper', 'Trial Mod'];
    hasStaffRole = interaction.member.roles.cache.some(role => {
      // Prüfe auf exakten Match für 'Team' oder Teil-Match für andere Rollen
      if (role.name === 'Team') {
        console.log(`Found exact Team role match: ${role.name}`);
        return true;
      }
      const matches = commonStaffRoleNames.some(name => 
        role.name.toLowerCase().includes(name.toLowerCase())
      );
      if (matches) console.log(`Found matching role: ${role.name}`);
      return matches;
    });
    console.log(`Method 2 - Checking by common names: ${hasStaffRole}`);
  }
  
  // Method 3: Check admin permission as final fallback
  if (!hasStaffRole) {
    hasStaffRole = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    console.log(`Method 3 - Checking by admin permission: ${hasStaffRole}`);
  }
  
  console.log(`Final result - User has staff role access: ${hasStaffRole}`);

  if (!hasStaffRole) {
    return interaction.reply({ 
      content: 'You need the staff role to use this command.', 
      ephemeral: true
    });
  }

  // Check for existing active LOAs first
  const activeLoasPath = path.join(__dirname, '..', 'data', 'active-loas.json');
  let activeLoasData = [];
  
  try {
    if (fs.existsSync(activeLoasPath)) {
      activeLoasData = JSON.parse(fs.readFileSync(activeLoasPath, 'utf8'));
    }
    
    // Check if user already has an active LOA
    const existingLoa = activeLoasData.find(loa => loa.userId === interaction.user.id);
    if (existingLoa) {
      // Get the LOA ID, supporting both old and new formats
      const existingLoaId = existingLoa.id || existingLoa.loaId || 'unknown';
      return interaction.reply({
        content: `❌ You already have an active LOA (ID: ${existingLoaId}). Please end your current LOA before creating a new one.`,
        ephemeral: true
      });
    }
  } catch (error) {
    console.error('Error checking existing LOAs:', error);
    return interaction.reply({
      content: '❌ An error occurred while checking for existing LOAs. Please try again later.',
      ephemeral: true
    });
  }

  // Get the options
  const startDate = interaction.options.getString('start-date');
  const endDate = interaction.options.getString('end-date');
  const reason = interaction.options.getString('reason');
  const type = interaction.options.getString('type');
  const isPrivate = interaction.options.getBoolean('private') || false;
  
  // Check if LOA role is configured
  const loaRoleId = staffConfig.loaRoleId;
  if (!loaRoleId) {
    console.warn('No LOA role configured for LOA requests');
  }
  
  // Validate dates
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    return interaction.reply({
      content: 'Invalid date format. Please use YYYY-MM-DD format.',
      ephemeral: true
    });
  }
  
  // Calculate number of days
  const start = new Date(startDate);
  const end = new Date(endDate);
  const durationDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  
  if (isNaN(durationDays) || durationDays < 0) {
    return interaction.reply({
      content: 'Invalid date range. End date must be after start date.',
      ephemeral: true
    });
  }
  
  // Generate LOA ID
  const loaId = `LOA-${Math.floor(Date.now() / 1000).toString(36).toUpperCase()}`;
  
  // Set color based on duration
  let color;
  let statusText;
  if (durationDays <= 3) {
    color = 0x00FF00; // Green for short leave
    statusText = '✅ Short Leave';
  } else if (durationDays <= 14) {
    color = 0xFFA500; // Orange for medium leave
    statusText = '⚠️ Extended Leave';
  } else {
    color = 0xFF0000; // Red for long leave
    statusText = '❗ Long-Term Absence';
  }

  // Get type icon
  const typeIcons = {
    'vacation': '🏖️',
    'personal': '🏠',
    'medical': '🏥',
    'school_work': '📚',
    'other': '❓'
  };
  
  // Create the embed
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`Staff Leave of Absence - ${typeIcons[type]} ${capitalizeFirstLetter(type)}`)
    .addFields(
      { name: 'Staff Member', value: interaction.user.toString(), inline: true },
      { name: 'Status', value: statusText, inline: true },
      { name: 'ID', value: loaId, inline: true },
      { name: 'Start Date', value: `📅 ${formatDate(startDate)}`, inline: true },
      { name: 'End Date', value: `📅 ${formatDate(endDate)}`, inline: true },
      { name: 'Duration', value: `⏱️ ${durationDays} day${durationDays !== 1 ? 's' : ''}`, inline: true },
      { name: `Reason (${type})`, value: reason },
    )
    .setTimestamp()
    .setFooter({ text: 'Staff LOA System • Use /staff-return when you come back' });
  
  // Assign LOA role to the user
  if (loaRoleId) {
    try {
      await interaction.member.roles.add(loaRoleId, `LOA from ${formatDate(startDate)} to ${formatDate(endDate)}`);
      console.log(`Assigned LOA role ${loaRoleId} to ${interaction.user.tag}`);
    } catch (error) {
      console.error('Error assigning LOA role:', error);
      // Still continue with the LOA process even if role assignment fails
    }
  }
  
  // If the user has an avatar, add it to the embed
  if (interaction.user.avatarURL()) {
    embed.setThumbnail(interaction.user.avatarURL());
  }
  
  // Save to active LOAs file (using variables already declared above)
  try {
    if (!fs.existsSync(activeLoasPath)) {
      // Initialize empty array if file doesn't exist
      activeLoasData = [];
    }
  } catch (error) {
    console.error('Error loading active LOAs:', error);
  }
  
  // Create an active LOA record
  const loaRecord = {
    id: loaId,
    userId: interaction.user.id,
    username: interaction.user.tag,
    startDate,
    endDate,
    reason,
    type,
    // contact wird nicht mehr verwendet oder als leerer String gesetzt
    contact: "",
    isPrivate,
    createdAt: new Date().toISOString(),
    approved: false,
    loaRoleId: loaRoleId || null
  };
  
  activeLoasData.push(loaRecord);
  
  try {
    fs.writeFileSync(activeLoasPath, JSON.stringify(activeLoasData, null, 2), 'utf8');
    console.log(`Saved LOA record for ${interaction.user.tag} to active LOAs file`);
  } catch (error) {
    console.error('Error saving LOA record:', error);
    // Continue with the process even if saving fails
  }
  
  // Always send an ephemeral message to the user confirming their LOA submission
  const confirmEmbed = new EmbedBuilder()
    .setColor('#2f3136')
    .setTitle('LOA Request Submitted')
    .setDescription(`Your LOA request has been submitted. ${!isPrivate ? 'It has been posted in the LOA channel for approval.' : 'It is marked as private and awaiting approval.'}`)
    .setTimestamp();
    
  await interaction.reply({
    embeds: [confirmEmbed],
    ephemeral: true
  });
  
  // Send LOA to the configured channel if available and not private
  if (!isPrivate && staffConfig.loaChannelId) {
    try {
      const loaChannel = await interaction.client.channels.fetch(staffConfig.loaChannelId);
      if (loaChannel && loaChannel.isTextBased()) {
        const channelMessage = await loaChannel.send({
          content: isPrivate ? `**PRIVATE LOA** - Only viewable by admins` : `${interaction.user.toString()} has submitted a leave of absence request.`,
          embeds: [embed],
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 3, // Success (green)
                  custom_id: `approve_loa_${loaId}`,
                  label: 'Approve',
                  emoji: '✅'
                },
                {
                  type: 2,
                  style: 4, // Danger (red)
                  custom_id: `deny_loa_${loaId}`,
                  label: 'Deny',
                  emoji: '❌'
                },
                {
                  type: 2,
                  style: 2, // Secondary (gray)
                  custom_id: `modify_loa_${loaId}`,
                  label: 'Request Changes',
                  emoji: '✏️'
                }
              ]
            }
          ]
        });
        
        // Store the message ID so it can be updated from the dashboard
        try {
          await storeLoaMessageId(loaId, channelMessage.id);
          console.log(`Stored message ID ${channelMessage.id} for LOA ${loaId}`);
        } catch (storageError) {
          console.error(`Error storing LOA message ID mapping: ${storageError.message}`);
        }
        
        // Create a thread in the LOA channel
        const thread = await channelMessage.startThread({
          name: `LOA: ${interaction.user.username} - ${formatDate(startDate)} to ${formatDate(endDate)}`,
          autoArchiveDuration: 10080, // 7 days
          reason: `Staff LOA thread for ${interaction.user.tag}`
        });
        
        await thread.send(`This thread is for discussing ${interaction.user.toString()}'s leave of absence. Please use it for coordinating coverage of their responsibilities.`);
        
        // Auto-join the thread to track it
        if (thread.joinable) await thread.join();
        
        console.log(`LOA announcement for ${interaction.user.tag} posted to channel ${loaChannel.name}`);
      } else {
        console.error(`Could not find or access LOA channel with ID ${staffConfig.loaChannelId}`);
      }
    } catch (error) {
      console.error('Error sending LOA to channel:', error);
    }
  }
  
  // DM an admin for approval if there are admins in the server
  const admins = interaction.guild.members.cache.filter(member => 
    member.permissions.has(PermissionFlagsBits.Administrator) && !member.user.bot);
  
  if (admins.size > 0) {
    const randomAdmin = admins.random();
    try {
      await randomAdmin.send({ 
        content: `New LOA request from ${interaction.user.tag} needs approval. ID: ${loaId}`,
        embeds: [embed]
      });
    } catch (error) {
      console.error('Could not DM admin:', error);
    }
  }
}

async function handleExtendCommand(interaction) {
  // Check staff role (same validation as in request command)
  // Load the staff configuration
  const configPath = path.join(__dirname, '..', 'data', 'staff-config.json');
  let staffConfig = { staffRoleId: '', loaRoleId: '' };
  
  try {
    if (fs.existsSync(configPath)) {
      staffConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading staff config:', error);
  }
  
  // Check if the user has the staff role
  let hasStaffRole = false;
  const staffRoleId = staffConfig.staffRoleId;
  
  // Method 1: Check by configured role ID if available
  if (staffRoleId) {
    hasStaffRole = interaction.member.roles.cache.has(staffRoleId);
  }
  
  // Method 2: Check by common staff role names as fallback
  if (!hasStaffRole) {
    const commonStaffRoleNames = ['Staff', 'Team', 'Admin', 'Moderator', 'Helper', 'Trial Mod'];
    hasStaffRole = interaction.member.roles.cache.some(role => {
      if (role.name === 'Team') return true;
      return commonStaffRoleNames.some(name => 
        role.name.toLowerCase().includes(name.toLowerCase())
      );
    });
  }
  
  // Method 3: Check admin permission as final fallback
  if (!hasStaffRole) {
    hasStaffRole = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
  }

  if (!hasStaffRole) {
    return interaction.reply({ 
      content: 'You need the staff role to use this command.', 
      ephemeral: true
    });
  }

  // Get options
  const loaId = interaction.options.getString('loa-id');
  const newEndDate = interaction.options.getString('new-end-date');
  const extensionReason = interaction.options.getString('reason');
  
  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(newEndDate)) {
    return interaction.reply({
      content: 'Invalid date format for new end date. Please use YYYY-MM-DD format.',
      ephemeral: true
    });
  }

  // Load active LOAs
  const activeLoasPath = path.join(__dirname, '..', 'data', 'active-loas.json');
  let activeLoasData = [];
  
  try {
    if (fs.existsSync(activeLoasPath)) {
      activeLoasData = JSON.parse(fs.readFileSync(activeLoasPath, 'utf8'));
    } else {
      return interaction.reply({
        content: '❌ No active LOAs found in the system.',
        ephemeral: true
      });
    }
    
    // Find the LOA to extend - check for both id and loaId fields for backward compatibility
    const loaIndex = activeLoasData.findIndex(loa => loa.id === loaId || loa.loaId === loaId);
    
    if (loaIndex === -1) {
      return interaction.reply({
        content: `❌ No active LOA found with ID: ${loaId}`,
        ephemeral: true
      });
    }
    
    // Check if it's the user's own LOA
    if (activeLoasData[loaIndex].userId !== interaction.user.id) {
      return interaction.reply({
        content: '❌ You can only extend your own LOA. This LOA belongs to someone else.',
        ephemeral: true
      });
    }
    
    // Ensure we're using a consistent id property
    if (!activeLoasData[loaIndex].id && activeLoasData[loaIndex].loaId) {
      activeLoasData[loaIndex].id = activeLoasData[loaIndex].loaId;
    }
    
    // Get the effective ID to use throughout this function
    const effectiveLoaId = activeLoasData[loaIndex].id || activeLoasData[loaIndex].loaId;
    
    // Check if the new end date is valid
    const currentEndDate = new Date(activeLoasData[loaIndex].endDate);
    const newEndDateObj = new Date(newEndDate);
    
    if (isNaN(newEndDateObj.getTime())) {
      return interaction.reply({
        content: '❌ Invalid date format. Please use YYYY-MM-DD format.',
        ephemeral: true
      });
    }
    
    if (newEndDateObj <= currentEndDate) {
      return interaction.reply({
        content: '❌ New end date must be later than the current end date.',
        ephemeral: true
      });
    }
    
    // Store old data for logging
    const oldLoa = { ...activeLoasData[loaIndex] };
    
    // Update the LOA
    activeLoasData[loaIndex].endDate = newEndDate;
    
    // Calculate new duration
    const startDate = new Date(activeLoasData[loaIndex].startDate);
    const durationDays = Math.ceil((newEndDateObj - startDate) / (1000 * 60 * 60 * 24));
    
    // Set color based on new duration
    let color;
    let statusText;
    if (durationDays <= 3) {
      color = 0x00FF00; // Green for short leave
      statusText = '✅ Short Leave (Extended)';
    } else if (durationDays <= 14) {
      color = 0xFFA500; // Orange for medium leave
      statusText = '⚠️ Extended Leave';
    } else {
      color = 0xFF0000; // Red for long leave
      statusText = '❗ Long-Term Absence (Extended)';
    }
    
    // Update LOA in file
    try {
      fs.writeFileSync(activeLoasPath, JSON.stringify(activeLoasData, null, 2), 'utf8');
      console.log(`Extended LOA for ${interaction.user.tag}: ${oldLoa.endDate} → ${newEndDate}`);
    } catch (error) {
      console.error('Error updating LOA record:', error);
      return interaction.reply({
        content: '❌ An error occurred while updating your LOA. Please try again later.',
        ephemeral: true
      });
    }
    
    // Create an embed for the extension notification
    const typeIcons = {
      'vacation': '🏖️',
      'personal': '🏠',
      'medical': '🏥',
      'school_work': '📚',
      'other': '❓'
    };
    
    const type = activeLoasData[loaIndex].type;
    
    const extensionEmbed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`LOA Extended - ${typeIcons[type] || '❓'} ${capitalizeFirstLetter(type || 'leave')}`)
      .addFields(
        { name: 'Staff Member', value: interaction.user.toString(), inline: true },
        { name: 'Status', value: statusText, inline: true },
        { name: 'ID', value: effectiveLoaId, inline: true },
        { name: 'Original End Date', value: `📅 ${formatDate(oldLoa.endDate)}`, inline: true },
        { name: 'New End Date', value: `📅 ${formatDate(newEndDate)}`, inline: true },
        { name: 'Updated Duration', value: `⏱️ ${durationDays} day${durationDays !== 1 ? 's' : ''}`, inline: true },
        { name: 'Extension Reason', value: extensionReason },
      )
      .setTimestamp()
      .setFooter({ text: 'Staff LOA System • Use /staff-return when you come back' });
    
    // If the user has an avatar, add it to the embed
    if (interaction.user.avatarURL()) {
      extensionEmbed.setThumbnail(interaction.user.avatarURL());
    }
    
    // Reply to the user
    await interaction.reply({
      content: `✅ Your LOA has been extended to ${formatDate(newEndDate)}.`,
      embeds: [extensionEmbed],
      ephemeral: true
    });
    
    // Notify in LOA channel if available and the original LOA wasn't private
    if (!activeLoasData[loaIndex].isPrivate && staffConfig.loaChannelId) {
      try {
        const loaChannel = await interaction.client.channels.fetch(staffConfig.loaChannelId);
        if (loaChannel && loaChannel.isTextBased()) {
          await loaChannel.send({
            content: `📝 ${interaction.user.toString()} has extended their Leave of Absence (ID: ${effectiveLoaId})`,
            embeds: [extensionEmbed]
          });
        }
      } catch (error) {
        console.error('Error sending LOA extension notification to channel:', error);
      }
    }
    
    // Notify an admin
    const admins = interaction.guild.members.cache.filter(member => 
      member.permissions.has(PermissionFlagsBits.Administrator) && !member.user.bot);
    
    if (admins.size > 0) {
      const randomAdmin = admins.random();
      try {
        await randomAdmin.send({ 
          content: `${interaction.user.tag} has extended their LOA (ID: ${effectiveLoaId})`,
          embeds: [extensionEmbed]
        });
      } catch (error) {
        console.error('Could not DM admin about LOA extension:', error);
      }
    }
  } catch (error) {
    console.error('Error handling LOA extension:', error);
    return interaction.reply({
      content: '❌ An error occurred while processing your request. Please try again later.',
      ephemeral: true
    });
  }
}

// Helper functions
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1).replace('_', ' ');
}
