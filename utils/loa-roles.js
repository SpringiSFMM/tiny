/**
 * Utility functions for managing LOA roles
 */

/**
 * Ensures that an LOA role exists in the server
 * @param {import('discord.js').Guild} guild - The Discord guild
 * @returns {Promise<string|null>} - The LOA role ID or null if it couldn't be created
 */
async function ensureLoaRoleExists(guild) {
  if (!guild) {
    console.error('Cannot ensure LOA role exists: Guild not provided');
    return null;
  }
  
  // Check if LOA role ID is configured
  let loaRoleId = process.env.LOA_ROLE_ID;
  
  // If we have a role ID, check if it actually exists in the server
  if (loaRoleId && loaRoleId.trim() !== '') {
    try {
      const existingRole = await guild.roles.fetch(loaRoleId).catch(() => null);
      if (existingRole) {
        console.log(`Found existing LOA role with ID: ${loaRoleId}`);
        return loaRoleId; // Role exists and is valid
      }
      console.log(`Role with ID ${loaRoleId} configured but not found in server`);
      // Role doesn't exist despite having an ID, will create a new one
    } catch (error) {
      console.error(`Error fetching LOA role: ${error.message}`);
      // Will attempt to create a new role
    }
  } else {
    console.log('No LOA role ID configured in environment variables');
  }
  
  // Either no role ID configured or the role doesn't exist anymore
  console.log('No valid LOA role found. Checking permissions before creating a new one...');
  
  // First check if bot has permissions to create roles
  try {
    const botMember = await guild.members.fetchMe();
    if (!botMember) {
      console.error('Cannot fetch bot member from guild');
      return null;
    }
    
    const canManageRoles = botMember.permissions.has('ManageRoles');
    if (!canManageRoles) {
      console.error('Bot does not have permission to manage roles in this server');
      return null;
    }
    
    console.log('Bot has permission to manage roles, creating new LOA role...');
    
    // Create a new LOA role with moderate permissions
    const loaRole = await guild.roles.create({
      name: 'On LOA',
      color: '#808080', // Gray color
      reason: 'Automatically created for LOA system',
      permissions: [],
      mentionable: false
    }).catch(error => {
      console.error(`Error in role creation API call: ${error.message}`);
      return null;
    });
    
    if (!loaRole) {
      console.error('Failed to create LOA role - API call failed');
      return null;
    }
    
    console.log(`Created new LOA role with ID: ${loaRole.id}`);
    
    // Update the .env file with the new role ID
    await updateEnvFile('LOA_ROLE_ID', loaRole.id);
    
    // Update process.env directly so it's available immediately
    process.env.LOA_ROLE_ID = loaRole.id;
    
    return loaRole.id;
  } catch (error) {
    console.error(`Failed to create LOA role: ${error.message}`);
    if (error.stack) console.error(error.stack);
    return null;
  }
}

/**
 * Updates a value in the .env file
 * @param {string} key - The key to update
 * @param {string} value - The new value
 */
async function updateEnvFile(key, value) {
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '..', '.env');
  
  try {
    if (!fs.existsSync(envPath)) {
      console.error('.env file not found');
      return;
    }
    
    let envContent = fs.readFileSync(envPath, 'utf8');
    const regex = new RegExp(`${key}=.*`, 'gm');
    
    if (envContent.match(regex)) {
      // Key exists, update its value
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      // Key doesn't exist, add it to the end
      envContent += `\n${key}=${value}\n`;
    }
    
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log(`Updated ${key} in .env file`);
  } catch (error) {
    console.error(`Failed to update .env file: ${error.message}`);
  }
}

/**
 * Assigns the LOA role to a member and schedules its removal when the LOA ends
 * @param {Object} options - The options object
 * @param {import('discord.js').GuildMember} options.guildMember - The guild member to assign the role to
 * @param {Date} options.endDate - The date when the LOA ends and the role should be removed
 * @param {String} options.loaId - The ID of the LOA request
 * @returns {Promise<boolean>} - Whether the role was assigned successfully
 */
async function assignLoaRole({ guildMember, endDate, loaId }) {
  if (!guildMember) {
    console.error('Cannot assign LOA role: Guild member not provided');
    return false;
  }
  
  console.log(`Attempting to assign LOA role to ${guildMember.user.tag} for LOA ${loaId}`);
  
  // Make sure we have a valid LOA role
  const loaRoleId = await ensureLoaRoleExists(guildMember.guild);
  
  if (!loaRoleId) {
    console.error('Cannot assign LOA role: No valid role ID available and unable to create one');
    return false;
  }
  
  try {
    // Verify the role still exists
    const role = await guildMember.guild.roles.fetch(loaRoleId).catch(err => {
      console.error(`Error fetching role before assignment: ${err.message}`);
      return null;
    });
    
    if (!role) {
      console.error(`Role with ID ${loaRoleId} no longer exists`);
      return false;
    }
    
    // Check if bot has permission to assign this role
    const botMember = await guildMember.guild.members.fetchMe();
    const canManageRoles = botMember.permissions.has('ManageRoles');
    const botHighestRole = botMember.roles.highest.position;
    const targetRolePosition = role.position;
    
    if (!canManageRoles) {
      console.error('Bot does not have ManageRoles permission');
      return false;
    }
    
    if (botHighestRole <= targetRolePosition) {
      console.error(`Bot's highest role (${botHighestRole}) is not high enough to assign role at position ${targetRolePosition}`);
      return false;
    }
    
    // Assign the LOA role
    await guildMember.roles.add(loaRoleId, `LOA started: ${loaId}`).catch(err => {
      throw new Error(`Role assignment API call failed: ${err.message}`);
    });
    
    console.log(`Successfully assigned LOA role to ${guildMember.user.tag} (${loaId})`);
    
    // Schedule role removal
    if (endDate && endDate instanceof Date && !isNaN(endDate)) {
      const now = new Date();
      const timeUntilEnd = endDate.getTime() - now.getTime();
      
      if (timeUntilEnd > 0) {
        // Store the information for role removal
        const loaData = {
          userId: guildMember.id,
          guildId: guildMember.guild.id,
          endDate: endDate.toISOString(),
          loaId: loaId
        };
        
        // Save to file system for persistence across restarts
        const fs = require('fs');
        const path = require('path');
        
        const loaFilePath = path.join(__dirname, '..', 'data', 'active-loas.json');
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(path.dirname(loaFilePath))) {
          fs.mkdirSync(path.dirname(loaFilePath), { recursive: true });
        }
        
        // Load existing data
        let loaRecords = [];
        try {
          if (fs.existsSync(loaFilePath)) {
            loaRecords = JSON.parse(fs.readFileSync(loaFilePath, 'utf8'));
          }
        } catch (error) {
          console.error(`Error reading LOA records: ${error.message}`);
          // Continue with empty records if file is corrupted
        }
        
        // Remove any existing records for this user (in case of re-approval)
        loaRecords = loaRecords.filter(record => !(record.userId === guildMember.id && record.loaId === loaId));
        
        // Add the new record
        loaRecords.push(loaData);
        
        // Save updated records
        try {
          fs.writeFileSync(loaFilePath, JSON.stringify(loaRecords, null, 2), 'utf8');
          console.log(`Scheduled LOA role removal for ${guildMember.user.tag} on ${endDate.toLocaleDateString()} (${loaId})`);
        } catch (fsError) {
          console.error(`Error saving LOA records: ${fsError.message}`);
          // Continue even if file writing fails - we'll still have in-memory timeout
        }
        
        // Schedule in memory for the current session
        setTimeout(async () => {
          await removeLoaRole({ guildMember, loaId }).catch(err => {
            console.error(`Error in scheduled role removal: ${err.message}`);
          });
        }, timeUntilEnd);
      }
    }
    
    return true;
  } catch (error) {
    console.error(`Error assigning LOA role: ${error.message}`);
    if (error.stack) console.error(error.stack);
    return false;
  }
}

/**
 * Removes the LOA role from a member
 * @param {Object} options - The options object
 * @param {import('discord.js').GuildMember} options.guildMember - The guild member to remove the role from
 * @param {String} options.loaId - The ID of the LOA request
 * @returns {Promise<boolean>} - Whether the role was removed successfully
 */
async function removeLoaRole({ guildMember, loaId, client }) {
  if (!guildMember) {
    console.error('Cannot remove LOA role: Guild member not provided');
    return false;
  }
  
  console.log(`Attempting to remove LOA role from ${guildMember.user.tag} for LOA ${loaId}`);
  
  // Make sure we have a valid LOA role ID
  const loaRoleId = process.env.LOA_ROLE_ID;
  
  if (!loaRoleId || loaRoleId.trim() === '') {
    console.error('No LOA role ID configured, cannot remove role');
    return false;
  }
  
  try {
    // First check if member has the role
    const hasRole = guildMember.roles.cache.has(loaRoleId);
    
    if (!hasRole) {
      console.log(`Member ${guildMember.user.tag} does not have the LOA role, nothing to remove`);
      // We'll still clean up records and send notification
    } else {
      // Verify the role still exists
      const role = await guildMember.guild.roles.fetch(loaRoleId).catch(err => {
        console.error(`Error fetching role before removal: ${err.message}`);
        return null;
      });
      
      if (!role) {
        console.error(`Role with ID ${loaRoleId} no longer exists, can't remove it`);
      } else {
        // Check if bot has permission to remove this role
        const botMember = await guildMember.guild.members.fetchMe();
        const canManageRoles = botMember.permissions.has('ManageRoles');
        const botHighestRole = botMember.roles.highest.position;
        const targetRolePosition = role.position;
        
        if (!canManageRoles) {
          console.error('Bot does not have ManageRoles permission');
          return false;
        }
        
        if (botHighestRole <= targetRolePosition) {
          console.error(`Bot's highest role (${botHighestRole}) is not high enough to remove role at position ${targetRolePosition}`);
          return false;
        }
        
        // Check if member has the role before trying to remove it
        if (!guildMember.roles.cache.has(loaRoleId)) {
          console.log(`User ${guildMember.user.tag} doesn't have the LOA role, skipping removal`);
          return true; // Consider this a success case
        }

        // Remove the role
        await guildMember.roles.remove(loaRoleId, `LOA ended: ${loaId || 'manual removal'}`);
        console.log(`Successfully removed LOA role from ${guildMember.user.tag} (${loaId})`);
      }
    }
    
    // Update active LOAs
    const fs = require('fs');
    const path = require('path');
    const loaFilePath = path.join(__dirname, '..', 'data', 'active-loas.json');
    
    if (fs.existsSync(loaFilePath)) {
      try {
        let loaRecords = JSON.parse(fs.readFileSync(loaFilePath, 'utf8'));
        const initialCount = loaRecords.length;
        
        // Filter out this record
        loaRecords = loaRecords.filter(record => 
          !(record.userId === guildMember.id && (!loaId || record.loaId === loaId))
        );
        
        if (initialCount !== loaRecords.length) {
          // Only write if we actually removed something
          fs.writeFileSync(loaFilePath, JSON.stringify(loaRecords, null, 2), 'utf8');
          console.log(`Removed LOA record for ${guildMember.user.tag} (${loaId}) from storage`);
        }
      } catch (error) {
        console.error('Error updating LOA records:', error);
        throw error; // Re-throw to be caught by the outer try-catch
      }
    }
    
    // Send DM to the user that their LOA has ended
    try {
      await guildMember.send({
        content: `Your Leave of Absence (${loaId}) has ended, and the LOA role has been automatically removed. Welcome back!`
      });
    } catch (dmError) {
      console.error(`Failed to send LOA ended DM: ${dmError.message}`);
    }
    
    return true;
  } catch (error) {
    console.error(`Error removing LOA role: ${error.message}`);
    if (error.stack) console.error(error.stack);
    return false;
  }
}

/**
 * Checks for any expired LOAs and removes their roles
 * @param {import('discord.js').Client} client - The Discord client
 */
async function checkExpiredLoas(client) {
  const fs = require('fs');
  const path = require('path');
  
  const loaFilePath = path.join(__dirname, '..', 'data', 'active-loas.json');
  const notifiedLoasPath = path.join(__dirname, '..', 'data', 'notified-loas.json');
  
  if (!fs.existsSync(loaFilePath)) {
    return;
  }
  
  try {
    // Load active LOAs
    let loaRecords = JSON.parse(fs.readFileSync(loaFilePath, 'utf8'));
    
    // Load or initialize notified LOAs tracking
    let notifiedLoas = [];
    if (fs.existsSync(notifiedLoasPath)) {
      try {
        notifiedLoas = JSON.parse(fs.readFileSync(notifiedLoasPath, 'utf8'));
      } catch (parseError) {
        console.error(`Error parsing notified LOAs: ${parseError.message}`);
        notifiedLoas = [];
      }
    }
    
    const now = new Date();
    const expiredLoas = loaRecords.filter(record => new Date(record.endDate) <= now);
    
    // Filter out LOAs that have already been notified
    const unnotifiedExpiredLoas = expiredLoas.filter(loa => {
      const loaKey = `${loa.userId}-${loa.loaId}`;
      return !notifiedLoas.includes(loaKey);
    });
    
    console.log(`Found ${expiredLoas.length} expired LOAs, ${unnotifiedExpiredLoas.length} not yet notified`);
    
    // Track newly notified LOAs in this run
    const newlyNotified = [];
    
    for (const loa of unnotifiedExpiredLoas) {
      const guild = client.guilds.cache.get(loa.guildId);
      if (guild) {
        try {
          const guildMember = await guild.members.fetch(loa.userId);
          await removeLoaRole({ guildMember, loaId: loa.loaId });
          
          // Add to notified list
          const loaKey = `${loa.userId}-${loa.loaId}`;
          newlyNotified.push(loaKey);
          
        } catch (error) {
          console.error(`Error processing expired LOA: ${error.message}`);
          
          // Despite the error, mark as notified to prevent repeated attempts
          const loaKey = `${loa.userId}-${loa.loaId}`;
          newlyNotified.push(loaKey);
          
          // Remove from records since we can't process it
          loaRecords = loaRecords.filter(record => 
            !(record.userId === loa.userId && record.loaId === loa.loaId)
          );
        }
      }
    }
    
    // Update notified LOAs list
    if (newlyNotified.length > 0) {
      // Add new notifications to the list
      notifiedLoas = [...notifiedLoas, ...newlyNotified];
      
      // Keep only notifications from the last 30 days to prevent the file from growing too large
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Remove expired LOAs from records (they've been processed)
      for (const loa of expiredLoas) {
        loaRecords = loaRecords.filter(record => 
          !(record.userId === loa.userId && record.loaId === loa.loaId)
        );
      }
      
      // Ensure data directory exists
      const dataDir = path.join(__dirname, '..', 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log(`Created data directory at ${dataDir}`);
      }
      
      // Save updated notified list
      fs.writeFileSync(notifiedLoasPath, JSON.stringify(notifiedLoas, null, 2), 'utf8');
      console.log(`Updated notified LOAs list with ${newlyNotified.length} new entries`);
      
      // Save updated records
      fs.writeFileSync(loaFilePath, JSON.stringify(loaRecords, null, 2), 'utf8');
    }
  } catch (error) {
    console.error(`Error checking expired LOAs: ${error.message}`);
    if (error.stack) console.error(error.stack);
  }
}

module.exports = {
  assignLoaRole,
  removeLoaRole,
  checkExpiredLoas,
  ensureLoaRoleExists
};
