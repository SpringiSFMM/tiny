const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { removeLoaRole } = require('../utils/loa-roles');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('staff-return')
    .setDescription('Return from Leave of Absence early')
    .addStringOption(option => 
      option.setName('comment')
        .setDescription('Optional comment about your early return')
        .setRequired(false)),
  
  async execute(interaction) {
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

    // Check if the user has the LOA role - checking both possible sources
    const configLoaRoleId = staffConfig.loaRoleId;
    const envLoaRoleId = process.env.LOA_ROLE_ID;
    
    console.log(`Checking for LOA role - Config ID: ${configLoaRoleId}, ENV ID: ${envLoaRoleId}`);
    
    // Check if either role ID is configured
    if (!configLoaRoleId && !envLoaRoleId) {
      return interaction.reply({
        content: 'No LOA role has been configured. Please contact an administrator.',
        ephemeral: true
      });
    }
    
    // Check both possible LOA roles
    const possibleRoleIds = [configLoaRoleId, envLoaRoleId].filter(id => id && id.trim() !== '');
    let hasLoaRole = false;
    let foundRoleId = null;
    
    for (const roleId of possibleRoleIds) {
      const hasRole = interaction.member.roles.cache.has(roleId);
      console.log(`Checking if user has LOA role ${roleId}: ${hasRole}`);
      if (hasRole) {
        hasLoaRole = true;
        foundRoleId = roleId;
        break;
      }
    }
    
    if (!hasLoaRole) {
      // Also check active LOAs in JSON file as a fallback
      const activeLoasPath = path.join(__dirname, '..', 'data', 'active-loas.json');
      let activeLoasData = [];
      
      try {
        if (fs.existsSync(activeLoasPath)) {
          activeLoasData = JSON.parse(fs.readFileSync(activeLoasPath, 'utf8'));
          const userHasActiveLoa = activeLoasData.some(loa => loa.userId === interaction.user.id);
          console.log(`Checking active LOAs file for user ${interaction.user.tag}: ${userHasActiveLoa}`);
          if (userHasActiveLoa) {
            hasLoaRole = true;
          }
        }
      } catch (error) {
        console.error('Error checking active LOAs file:', error);
      }
      
      // If still no LOA found
      if (!hasLoaRole) {
        return interaction.reply({
          content: 'You don\'t have an active Leave of Absence to return from.',
          ephemeral: true
        });
      }
    } else {
      console.log(`Found active LOA role with ID ${foundRoleId} on user ${interaction.user.tag}`);
    }

    // Make sure we have the active LOAs data (might have been loaded above)
    const activeLoasPath = path.join(__dirname, '..', 'data', 'active-loas.json');
    let activeLoasData = [];
    
    try {
      if (fs.existsSync(activeLoasPath)) {
        activeLoasData = JSON.parse(fs.readFileSync(activeLoasPath, 'utf8'));
      }
    } catch (error) {
      console.error('Error loading active LOAs:', error);
    }

    // Find this user's active LOA
    const userId = interaction.user.id;
    const userLoaIndex = activeLoasData.findIndex(loa => loa.userId === userId);
    let loaDetails = null;
    
    if (userLoaIndex !== -1) {
      loaDetails = activeLoasData[userLoaIndex];
      // Remove from the active LOAs list
      activeLoasData.splice(userLoaIndex, 1);
      
      // Save updated active LOAs
      try {
        // Ensure directory exists
        const dataDir = path.join(__dirname, '..', 'data');
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        
        fs.writeFileSync(activeLoasPath, JSON.stringify(activeLoasData, null, 2), 'utf8');
        console.log(`Removed LOA record for ${interaction.user.tag}`);
      } catch (error) {
        console.error('Error saving active LOAs:', error);
      }
    }

    // Remove the LOA role using the utility function
    try {
      // First try the LOA role from environment variable (used by the rest of the system)
      const envLoaRoleId = process.env.LOA_ROLE_ID;
      
      // Then try the LOA role from staff config as fallback
      const configLoaRoleId = staffConfig.loaRoleId;
      
      console.log(`LOA Role IDs - ENV: ${envLoaRoleId || 'not set'}, Config: ${configLoaRoleId || 'not set'}`);
      
      // Try all possible role IDs to ensure we remove the correct LOA role
      const possibleRoleIds = [envLoaRoleId, configLoaRoleId].filter(id => id && id.trim() !== '');
      
      if (possibleRoleIds.length > 0) {
        for (const roleId of possibleRoleIds) {
          console.log(`Attempting to remove role ${roleId} from ${interaction.user.tag}`);
          
          if (interaction.member.roles.cache.has(roleId)) {
            await interaction.member.roles.remove(roleId, `LOA ended early: ${loaDetails?.id || 'manual removal'}`);
            console.log(`Successfully removed role ${roleId} from ${interaction.user.tag}`);
          } else {
            console.log(`User ${interaction.user.tag} doesn't have the role ${roleId}, skipping removal`);
          }
        }
      } else {
        console.log(`No LOA role IDs configured in environment or staff-config.json`);
      }
      
      // Also use the utility function which handles additional cleanup
      await removeLoaRole({ 
        guildMember: interaction.member, 
        loaId: loaDetails?.id || 'early-return',
        client: interaction.client
      });
      
      console.log(`Successfully processed early return for ${interaction.user.tag}`);
    } catch (error) {
      console.error('Error in staff-return:', error);
      return interaction.reply({
        content: '❌ An error occurred while processing your return. Please contact an administrator.',
        ephemeral: true
      });
    }

    // Optional comment from the user
    const comment = interaction.options.getString('comment') || 'No additional comment provided.';

    // Create embed for return announcement
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('Staff Member Returned from Leave')
      .setDescription(`${interaction.user.toString()} has returned from their Leave of Absence early.`)
      .addFields(
        { name: 'Staff Member', value: interaction.user.toString(), inline: true },
        { name: 'Return Date', value: `📅 ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`, inline: true },
        { name: 'Comment', value: comment }
      )
      .setTimestamp()
      .setFooter({ text: 'Staff LOA System' });

    // If the user has an avatar, add it to the embed
    if (interaction.user.avatarURL()) {
      embed.setThumbnail(interaction.user.avatarURL());
    }

    // Original end date info if available
    if (loaDetails && loaDetails.endDate) {
      const endDate = new Date(loaDetails.endDate);
      const daysEarly = Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24));
      
      if (daysEarly > 0) {
        embed.addFields({ 
          name: 'Returned Early', 
          value: `🕒 ${daysEarly} day${daysEarly !== 1 ? 's' : ''} before scheduled end date`, 
          inline: true 
        });
      }
    }

    // Reply to the user
    await interaction.reply({ 
      content: 'You have successfully returned from your Leave of Absence.',
      ephemeral: true
    });

    // Send public announcement
    const staffChannel = process.env.STAFF_CHANNEL_ID 
      ? interaction.client.channels.cache.get(process.env.STAFF_CHANNEL_ID)
      : null;

    if (staffChannel) {
      staffChannel.send({ embeds: [embed] })
        .catch(error => console.error('Error sending to staff channel:', error));
    } else {
      // Send to the current channel if no staff channel is configured
      interaction.channel.send({ embeds: [embed] })
        .catch(error => console.error('Error sending to current channel:', error));
    }

    // If there was a scheduled task to remove the role, we can't directly cancel it
    // since it was set with setTimeout which doesn't return a reference we can use
    // That's fine because our removeLoaRole function checks if the user still has the role
  },
};
