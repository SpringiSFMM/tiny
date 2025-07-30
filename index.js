const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, REST, Routes, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import utilities
const { assignLoaRole, removeLoaRole, checkExpiredLoas } = require('./utils/loa-roles');
const { startStatsReporting, incrementCommandCount } = require('./utils/stats');

// Create a new client instance
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ] 
});

// Collections for commands and button handlers
client.commands = new Collection();
client.buttons = new Collection();

// Get command files
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Load commands
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  
  // Set a new item in the Collection with the key as the command name and the value as the exported module
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
  }
}

// Get and load event files
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
  
  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
      console.log(`Loaded one-time event: ${event.name}`);
    } else {
      client.on(event.name, (...args) => event.execute(...args));
      console.log(`Loaded event: ${event.name}`);
    }
  }
}

// Register button handlers
const buttonHandlers = {
  // Post Status Update buttons
  bug_update: async (interaction, bugId) => {
    const member = interaction.member;
    const isStaff = checkStaffRole(member);
    
    if (!isStaff) {
      return interaction.reply({
        content: 'You need to be a staff member to post status updates.',
        ephemeral: true
      });
    }
    
    // Create a modal for entering the update
    const modal = new ModalBuilder()
      .setCustomId(`status_update_modal_${bugId}`)
      .setTitle('Post Status Update');
      
    const updateInput = new TextInputBuilder()
      .setCustomId('status_update')
      .setLabel('Status Update')
      .setPlaceholder('Enter the status update for this issue...')
      .setStyle(TextInputStyle.Paragraph)
      .setMinLength(5)
      .setMaxLength(1000);
      
    const firstActionRow = new ActionRowBuilder().addComponents(updateInput);
    modal.addComponents(firstActionRow);
    
    await interaction.showModal(modal);
  },
  
  bug_subscribe: async (interaction, bugId) => {
    await interaction.reply({
      content: `You've subscribed to updates for bug ${bugId}. You'll receive notifications when the status changes.`,
      ephemeral: true
    });
  },
  
  // Suggestion buttons for accept/reject
  suggestion_accept: async (interaction, suggestionId) => {
    const member = interaction.member;
    const isStaff = checkStaffRole(member);
    
    if (!isStaff) {
      return interaction.reply({
        content: 'You need to be a staff member to accept suggestions.',
        ephemeral: true
      });
    }
    
    // First, defer the reply to buy us more time
    await interaction.deferUpdate();
    
    // Update the original embed
    const message = await interaction.message;
    const embed = message.embeds[0];
    
    const newEmbed = EmbedBuilder.from(embed)
      .setColor('#00FF00') // Green for approved
      .setDescription(`**Status:** Approved by ${interaction.user.username}\n\n${embed.description.split('\n\n')[1]}`);
    
    await interaction.editReply({ embeds: [newEmbed], components: [] });
    
    // Synchronize with dashboard database
    try {
      const { updateLoaStatus } = require('./utils/loa-sync-cjs');
      await updateLoaStatus(suggestionId, {
        approved: true,
        denied: false,
        updatedBy: interaction.user.username,
        updatedById: interaction.user.id
      });
      console.log(`LOA ${suggestionId} approved in dashboard by ${interaction.user.username}`);
    } catch (syncError) {
      console.error(`Error syncing LOA approval to dashboard: ${syncError.message}`);
      // Don't fail the approval if sync fails
    }
  },
  
  suggestion_reject: async (interaction, suggestionId) => {
    const member = interaction.member;
    const isStaff = checkStaffRole(member);
    
    if (!isStaff) {
      return interaction.reply({
        content: 'You need to be a staff member to reject suggestions.',
        ephemeral: true
      });
    }
    
    // Create a modal for rejection reason
    const modal = new ModalBuilder()
      .setCustomId(`suggestion_reject_modal_${suggestionId}`)
      .setTitle('Reject Suggestion');
      
    const reasonInput = new TextInputBuilder()
      .setCustomId('rejection_reason')
      .setLabel('Reason for rejection')
      .setPlaceholder('Explain why this suggestion is being rejected...')
      .setStyle(TextInputStyle.Paragraph)
      .setMinLength(5)
      .setMaxLength(1000);
      
    const firstActionRow = new ActionRowBuilder().addComponents(reasonInput);
    modal.addComponents(firstActionRow);
    
    await interaction.showModal(modal);
  },
  
  // Punish request button handlers
  punish_approve: async (interaction, requestId) => {
    const member = interaction.member;
    const isStaff = checkStaffRole(member);
    
    if (!isStaff) {
      return interaction.reply({
        content: 'You need to be a staff member to use this button.',
        ephemeral: true
      });
    }
    
    // First defer the reply to buy time
    await interaction.deferUpdate();
    
    // Find the thread associated with this message
    let thread = null;
    if (interaction.message.thread) {
      thread = interaction.message.thread;
    } else {
      const threads = await interaction.channel.threads.fetchActive();
      thread = threads.threads.find(t => t.starterId === interaction.message.id);
      
      if (!thread) {
        const archivedThreads = await interaction.channel.threads.fetchArchived();
        thread = archivedThreads.threads.find(t => t.starterId === interaction.message.id);
      }
    }
    
    // Update the original embed
    const originalEmbed = interaction.message.embeds[0];
    
    // Kopiere die Felder ohne Status-Felder
    const filteredFields = originalEmbed.fields?.filter(field => field.name !== 'Status') || [];
    
    // Erstelle ein neues Embed mit den gefilterten Feldern
    const updatedEmbed = EmbedBuilder.from(originalEmbed)
      .setColor(0x00FF00)
      .setFields(
        ...filteredFields,
        { name: 'Status', value: `✅ Approved by ${interaction.user.tag}`, inline: true }
      );
    
    // Buttons NICHT deaktivieren, damit alle Teammitglieder weiterhin interagieren können
    
    // Update the message with the new embed only
    await interaction.message.edit({ 
      embeds: [updatedEmbed]
      // Keine components angeben, damit die ursprünglichen Buttons aktiv bleiben
    });
    
    // Post message in thread if available
    if (thread) {
      await thread.send({
        content: `✅ **Punishment request approved** by ${interaction.user}. The player will be punished accordingly.`
      });
    }
    
    // Send follow-up to the user
    await interaction.followUp({
      content: `You've approved punishment request ${requestId}. The player will be punished accordingly.`,
      ephemeral: true
    });
  },
  
  punish_deny: async (interaction, requestId) => {
    const member = interaction.member;
    const isStaff = checkStaffRole(member);
    
    if (!isStaff) {
      return interaction.reply({
        content: 'You need to be a staff member to use this button.',
        ephemeral: true
      });
    }
    
    // First defer the reply to buy time
    await interaction.deferUpdate();
    
    // Find the thread associated with this message
    let thread = null;
    if (interaction.message.thread) {
      thread = interaction.message.thread;
    } else {
      const threads = await interaction.channel.threads.fetchActive();
      thread = threads.threads.find(t => t.starterId === interaction.message.id);
      
      if (!thread) {
        const archivedThreads = await interaction.channel.threads.fetchArchived();
        thread = archivedThreads.threads.find(t => t.starterId === interaction.message.id);
      }
    }
    
    // Update the original embed
    const originalEmbed = interaction.message.embeds[0];
    
    // Kopiere die Felder ohne Status-Felder
    const filteredFields = originalEmbed.fields?.filter(field => field.name !== 'Status') || [];
    
    // Erstelle ein neues Embed mit den gefilterten Feldern
    const updatedEmbed = EmbedBuilder.from(originalEmbed)
      .setColor(0xFF0000)
      .setFields(
        ...filteredFields,
        { name: 'Status', value: `❌ Denied by ${interaction.user.tag}`, inline: true }
      );
    
    // Buttons NICHT deaktivieren, damit alle Teammitglieder weiterhin interagieren können
    
    // Update the message with the new embed only
    await interaction.message.edit({ 
      embeds: [updatedEmbed]
      // Keine components angeben, damit die ursprünglichen Buttons aktiv bleiben
    });
    
    // Post message in thread if available
    if (thread) {
      await thread.send({
        content: `❌ **Punishment request denied** by ${interaction.user}.`
      });
    }
    
    // Send follow-up to the user
    await interaction.followUp({
      content: `You've denied punishment request ${requestId}.`,
      ephemeral: true
    });
  },
  
  punish_escalate: async (interaction, requestId) => {
    const member = interaction.member;
    const isStaff = checkStaffRole(member);
    
    if (!isStaff) {
      return interaction.reply({
        content: 'You need to be a staff member to use this button.',
        ephemeral: true
      });
    }
    
    // First defer the reply to buy time
    await interaction.deferUpdate();
    
    // Find the thread associated with this message
    let thread = null;
    if (interaction.message.thread) {
      thread = interaction.message.thread;
    } else {
      const threads = await interaction.channel.threads.fetchActive();
      thread = threads.threads.find(t => t.starterId === interaction.message.id);
      
      if (!thread) {
        const archivedThreads = await interaction.channel.threads.fetchArchived();
        thread = archivedThreads.threads.find(t => t.starterId === interaction.message.id);
      }
    }
    
    // Update the original embed
    const originalEmbed = interaction.message.embeds[0];
    
    // Kopiere die Felder ohne Status-Felder
    const filteredFields = originalEmbed.fields?.filter(field => field.name !== 'Status') || [];
    
    // Erstelle ein neues Embed mit den gefilterten Feldern
    const updatedEmbed = EmbedBuilder.from(originalEmbed)
      .setColor(0xFF9900)
      .setFields(
        ...filteredFields,
        { name: 'Status', value: `⬆️ Escalated by ${interaction.user.tag}`, inline: true }
      );
    
    // WICHTIG: NICHT die Buttons deaktivieren, damit höherrangige Teammitglieder sie noch nutzen können
    
    // Get higher role IDs from config or environment variables
    // Order by hierarchy - from lowest to highest
    const roleHierarchy = [
      process.env.STAFF_ROLE_ID || '1307038459915141263',  // Staff
      process.env.TEAM_ROLE_ID || '1308042640926707733',   // Team
      process.env.ADMIN_ROLE_ID || '1307038465468403764'   // Admin
    ];
    
    // Find the next highest role to ping
    let roleToPing = null;
    const userRoleIds = member.roles.cache.map(r => r.id);
    
    // Find the highest role the user has in our hierarchy
    let userHighestRoleIndex = -1;
    for (let i = 0; i < roleHierarchy.length; i++) {
      if (userRoleIds.includes(roleHierarchy[i])) {
        userHighestRoleIndex = i;
      }
    }
    
    // Get the next highest role if available
    if (userHighestRoleIndex < roleHierarchy.length - 1) {
      roleToPing = roleHierarchy[userHighestRoleIndex + 1];
    } else {
      // If user already has the highest role, ping the highest
      roleToPing = roleHierarchy[roleHierarchy.length - 1];
    }
    
    console.log(`Escalating from user with highest role index: ${userHighestRoleIndex}`);
    console.log(`Role to ping ID: ${roleToPing}`);
    
    // Update the message with the new embed but KEEP buttons active
    await interaction.message.edit({ 
      embeds: [updatedEmbed]
      // Keine components hier, um die ursprünglichen Buttons beizubehalten
    });
    
    // Post message in thread if available with ping to higher role
    // Direkter Ping mit @ Erwähnung für die Rolle
    if (thread) {
      try {
        console.log(`Trying to ping role ID: ${roleToPing} in thread`);
        await thread.send({
          content: `<@&${roleToPing}> ⬆️ **Punishment request escalated** by ${interaction.user}. This case requires higher authority review.`,
          allowedMentions: { parse: ['roles'] } // Sicherstellen, dass Rollen gepingt werden dürfen
        });
        console.log('Thread message with ping sent successfully');
      } catch (error) {
        console.error(`Error sending ping message to thread: ${error.message}`);
      }
    }
    
    // Send follow-up to the user
    await interaction.followUp({
      content: `You've escalated punishment request ${requestId} to senior staff. The appropriate team has been notified.`,
      ephemeral: true
    });
  },
  
  // Bug report button handlers
  bug_confirm: async (interaction, bugId) => {
    const member = interaction.member;
    const isStaff = checkStaffRole(member);
    
    if (!isStaff) {
      return interaction.reply({
        content: 'You need to be a staff member to use this button.',
        ephemeral: true
      });
    }
    
    await interaction.reply({
      content: `You've confirmed bug ${bugId} as a valid issue.`,
      ephemeral: true
    });
    
    // Update the original embed
    const originalEmbed = interaction.message.embeds[0];
    const updatedEmbed = EmbedBuilder.from(originalEmbed)
      .setFields(
        ...originalEmbed.fields.filter(field => field.name !== 'Status'),
        { name: 'Status', value: `✅ Confirmed by ${interaction.user.tag}`, inline: true }
      );
    
    await interaction.message.edit({ embeds: [updatedEmbed] });
  },
  
  bug_fixed: async (interaction, bugId) => {
    const member = interaction.member;
    const isStaff = checkStaffRole(member);
    
    if (!isStaff) {
      return interaction.reply({
        content: 'You need to be a staff member to use this button.',
        ephemeral: true
      });
    }
    
    await interaction.reply({
      content: `You've marked bug ${bugId} as fixed.`,
      ephemeral: true
    });
    
    // Update the original embed
    const originalEmbed = interaction.message.embeds[0];
    const updatedEmbed = EmbedBuilder.from(originalEmbed)
      .setColor(0x00FF00)
      .setFields(
        ...originalEmbed.fields.filter(field => field.name !== 'Status'),
        { name: 'Status', value: `🛠️ Fixed by ${interaction.user.tag}`, inline: true }
      );
    
    await interaction.message.edit({ embeds: [updatedEmbed] });
  },
  
  bug_invalid: async (interaction, bugId) => {
    const member = interaction.member;
    const isStaff = checkStaffRole(member);
    
    if (!isStaff) {
      return interaction.reply({
        content: 'You need to be a staff member to use this button.',
        ephemeral: true
      });
    }
    
    await interaction.reply({
      content: `You've marked bug ${bugId} as invalid/not a bug.`,
      ephemeral: true
    });
    
    // Update the original embed
    const originalEmbed = interaction.message.embeds[0];
    const updatedEmbed = EmbedBuilder.from(originalEmbed)
      .setColor(0xFF0000)
      .setFields(
        ...originalEmbed.fields.filter(field => field.name !== 'Status'),
        { name: 'Status', value: `❌ Invalid - Not a bug (${interaction.user.tag})`, inline: true }
      );
    
    await interaction.message.edit({ embeds: [updatedEmbed] });
  },
  
  bug_duplicate: async (interaction, bugId) => {
    const member = interaction.member;
    const isStaff = checkStaffRole(member);
    
    if (!isStaff) {
      return interaction.reply({
        content: 'You need to be a staff member to use this button.',
        ephemeral: true
      });
    }
    
    await interaction.reply({
      content: `You've marked bug ${bugId} as a duplicate of an existing bug.`,
      ephemeral: true
    });
    
    // Update the original embed
    const originalEmbed = interaction.message.embeds[0];
    const updatedEmbed = EmbedBuilder.from(originalEmbed)
      .setColor(0xAAAAAA)
      .setFields(
        ...originalEmbed.fields.filter(field => field.name !== 'Status'),
        { name: 'Status', value: `🔄 Duplicate (${interaction.user.tag})`, inline: true }
      );
    
    await interaction.message.edit({ embeds: [updatedEmbed] });
  },
  
  // Suggestion button handlers
  suggestion_upvote: async (interaction, suggestionId) => {
    // Check if the user has already voted
    const userId = interaction.user.id;
    const messageId = interaction.message.id;
    const voteKey = `${messageId}_${userId}`;
    
    // Here you would ideally have a database to store votes
    // For now, we'll just acknowledge the vote
    await interaction.reply({
      content: `You upvoted suggestion ${suggestionId}.`,
      ephemeral: true
    });
  },
  
  suggestion_downvote: async (interaction, suggestionId) => {
    await interaction.reply({
      content: `You downvoted suggestion ${suggestionId}.`,
      ephemeral: true
    });
  },
  
  // Staff LOA button handlers
  loa_approve: async (interaction, loaId) => {
    try {
      console.log(`Button pressed: approve_loa_${loaId} (handler: approve_loa)`);
      const member = interaction.member;
      const canManageStaffLoa = checkStaffLoaRole(member);
      
      if (!canManageStaffLoa) {
        return await interaction.reply({
          content: 'You need to have one of the authorized roles to approve Staff LOA requests.',
          ephemeral: true
        });
      }
      
      // First, defer the reply to buy us more time (extends from 3s to 15min)
      try {
        await interaction.deferUpdate();
        console.log('Interaction deferred successfully');
      } catch (deferError) {
        console.error(`Error deferring interaction: ${deferError.message}`);
        // Try to continue even if we can't defer
      }
      
      // Initialize variables we'll use
      let staffMember = null;
      let guildMember = null;
      let staffUserId = null;
      let endDate = null;
      let originalEmbed = null;
      
      // Extract info from embed
      try {
        // Get original embed
        originalEmbed = interaction.message.embeds[0];
        console.log('Retrieved original embed');
        
        // Find staff member info
        const staffMemberField = originalEmbed.fields.find(field => field.name === 'Staff Member');
        if (staffMemberField) {
          const userIdMatch = staffMemberField.value.match(/<@(\d+)>/);
          if (userIdMatch && userIdMatch[1]) {
            staffUserId = userIdMatch[1];
            console.log(`Found staff user ID: ${staffUserId}`);
            
            try {
              staffMember = await interaction.client.users.fetch(staffUserId);
              console.log(`Fetched staff member: ${staffMember.tag}`);
            } catch (fetchError) {
              console.error(`Error fetching user: ${fetchError.message}`);
            }
            
            try {
              guildMember = await interaction.guild.members.fetch(staffUserId);
              console.log(`Fetched guild member for ${staffUserId}`);
            } catch (memberError) {
              console.error(`Failed to fetch guild member: ${memberError.message}`);
            }
          } else {
            console.log('Could not extract user ID from staff member field');
          }
        } else {
          console.log('Could not find Staff Member field in embed');
        }
        
        // Find end date info
        const endDateField = originalEmbed.fields.find(field => field.name === 'End Date');
        if (endDateField) {
          const dateMatch = endDateField.value.match(/\ud83d\udcc5\s+(.+)/);
          if (dateMatch && dateMatch[1]) {
            endDate = new Date(dateMatch[1]);
            console.log(`Parsed end date: ${endDate.toISOString()}`);
          } else {
            console.log('Could not extract date from End Date field');
          }
        } else {
          console.log('Could not find End Date field in embed');
        }
      } catch (extractError) {
        console.error(`Error extracting information from embed: ${extractError.message}`);
        if (extractError.stack) console.error(extractError.stack);
      }
      
      // Update the embed with approval status
      try {
        if (originalEmbed) {
          // Kopiere die Felder ohne Status-Felder
          const filteredFields = originalEmbed.fields?.filter(field => field.name !== 'Status') || [];
          
          // Erstelle ein neues Embed mit den gefilterten Feldern
          const approvedEmbed = EmbedBuilder.from(originalEmbed)
            .setColor(0x00FF00)
            .setFields(
              ...filteredFields,
              { name: 'Status', value: `\u2705 Approved by ${interaction.user.tag}`, inline: true }
            );
          
          // Try to update the message with minimal embed
          await interaction.message.edit({ embeds: [approvedEmbed] })
            .then(() => console.log('Successfully updated embed with approval status'))
            .catch(error => {
              console.error(`Failed to update embed: ${error.message}`);
              throw error; // Re-throw to be caught by outer try-catch
            });
        }
      } catch (embedError) {
        console.error(`Error updating embed: ${embedError.message}`);
        if (embedError.stack) console.error(embedError.stack);
        // Continue with approval process even if embed update fails
      }
      
      // Assign LOA role if possible
      let roleAssigned = false;
      
      if (guildMember && endDate) {
        console.log(`Attempting to assign LOA role to ${guildMember.user.tag}`);
        try {
          // Direct role management without relying on external utility
          let loaRoleId = process.env.LOA_ROLE_ID;
          let loaRole = null;
          
          // Check if role ID exists and is valid
          if (loaRoleId && loaRoleId.trim() !== '') {
            console.log(`Looking up existing LOA role with ID: ${loaRoleId}`);
            // Try to fetch the role
            try {
              loaRole = await interaction.guild.roles.fetch(loaRoleId);
              console.log(`Found existing LOA role: ${loaRole ? loaRole.name : 'null'}`);
            } catch (fetchError) {
              console.log(`Could not fetch LOA role: ${fetchError.message}`);
              loaRole = null;
            }
          }
          
          // If role doesn't exist, create it
          if (!loaRole) {
            console.log('Creating new LOA role...');
            try {
              // Check bot permissions
              const botMember = await interaction.guild.members.fetchMe();
              if (!botMember.permissions.has('ManageRoles')) {
                console.error('Bot does not have ManageRoles permission');
                throw new Error('Bot does not have ManageRoles permission');
              }
              
              loaRole = await interaction.guild.roles.create({
                name: 'On LOA',
                color: '#808080', // Gray color
                reason: 'Automatically created for LOA system',
                permissions: [],
                mentionable: false
              });
              
              console.log(`Successfully created new LOA role with ID: ${loaRole.id}`);
              
              // Update process.env directly
              process.env.LOA_ROLE_ID = loaRole.id;
              
              // Also update the .env file if possible
              try {
                const fs = require('fs');
                const path = require('path');
                const envPath = path.join(__dirname, '.env');
                
                if (fs.existsSync(envPath)) {
                  let envContent = fs.readFileSync(envPath, 'utf8');
                  
                  // Replace existing LOA_ROLE_ID line or add if not exists
                  if (envContent.includes('LOA_ROLE_ID=')) {
                    envContent = envContent.replace(/LOA_ROLE_ID=.*$/m, `LOA_ROLE_ID=${loaRole.id}`);
                  } else {
                    envContent += `\nLOA_ROLE_ID=${loaRole.id}`;
                  }
                  
                  fs.writeFileSync(envPath, envContent, 'utf8');
                  console.log('Updated .env file with new LOA role ID');
                } else {
                  console.log('Could not find .env file to update');
                }
              } catch (envError) {
                console.error(`Error updating .env file: ${envError.message}`);
              }
            } catch (createError) {
              console.error(`Failed to create LOA role: ${createError.message}`);
              if (createError.stack) console.error(createError.stack);
            }
          }
          
          // Now assign the role if we have it
          if (loaRole) {
            console.log(`Assigning LOA role ${loaRole.id} to ${guildMember.user.tag}`);
            
            // Check role hierarchy
            const botMember = await interaction.guild.members.fetchMe();
            const botHighestRole = botMember.roles.highest.position;
            
            if (botHighestRole <= loaRole.position) {
              console.error(`Bot's highest role position (${botHighestRole}) is not high enough to assign LOA role at position ${loaRole.position}`);
            } else {
              // Assign the role
              try {
                await guildMember.roles.add(loaRole.id, `LOA started: ${loaId}`);
                console.log(`Successfully assigned LOA role to ${guildMember.user.tag}`);
                roleAssigned = true;
                
                // Schedule role removal
                if (endDate && endDate instanceof Date && !isNaN(endDate)) {
                  const now = new Date();
                  const timeUntilEnd = endDate.getTime() - now.getTime();
                  
                  if (timeUntilEnd > 0) {
                    console.log(`Scheduling LOA role removal for ${endDate.toLocaleDateString()}`);
                    
                    // Store LOA info for persistence
                    try {
                      const fs = require('fs');
                      const path = require('path');
                      const loaFilePath = path.join(__dirname, 'data', 'active-loas.json');
                      
                      // Ensure directory exists
                      const dir = path.dirname(loaFilePath);
                      if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                        console.log(`Created directory: ${dir}`);
                      }
                      
                      // Read existing LOAs or create empty array
                      let loaRecords = [];
                      if (fs.existsSync(loaFilePath)) {
                        try {
                          loaRecords = JSON.parse(fs.readFileSync(loaFilePath, 'utf8'));
                        } catch (readError) {
                          console.error(`Error reading LOA records: ${readError.message}`);
                        }
                      }
                      
                      // Remove any existing record for this LOA
                      loaRecords = loaRecords.filter(r => !(r.userId === guildMember.id && r.loaId === loaId));
                      
                      // Add new record
                      loaRecords.push({
                        userId: guildMember.id,
                        guildId: interaction.guild.id,
                        endDate: endDate.toISOString(),
                        loaId: loaId
                      });
                      
                      // Save to file
                      fs.writeFileSync(loaFilePath, JSON.stringify(loaRecords, null, 2), 'utf8');
                      console.log(`Saved LOA record to ${loaFilePath}`);
                    } catch (fsError) {
                      console.error(`Error saving LOA record: ${fsError.message}`);
                    }
                  }
                }
              } catch (addError) {
                console.error(`Error adding role: ${addError.message}`);
                if (addError.stack) console.error(addError.stack);
              }
            }
          } else {
            console.error('Failed to get or create LOA role');
          }
        } catch (envError) {
          console.error(`Error updating .env file: ${envError.message}`);
        }
      }

      // Synchronize with dashboard database
      try {
        const { updateLoaStatus } = require('./utils/loa-sync-cjs');
        await updateLoaStatus(loaId, {
          approved: true,
          denied: false,
          updatedBy: interaction.user.username,
          updatedById: interaction.user.id
        });
        console.log(`LOA ${loaId} approved in dashboard by ${interaction.user.username}`);
        
        // Send IPC message to dashboard for real-time updates
        try {
          const { sendMessage } = require('./utils/ipc-cjs');
          sendMessage('loa_status_update', {
            loaId,
            action: 'approve',
            updatedBy: interaction.user.username,
            updatedById: interaction.user.id,
            timestamp: new Date().toISOString()
          });
          console.log(`LOA status update sent via IPC for ${loaId} (approved)`);
        } catch (ipcError) {
          console.error(`Error sending IPC message for LOA approval: ${ipcError.message}`);
          // Don't fail if IPC messaging fails
        }
      } catch (syncError) {
        console.error(`Error syncing LOA approval to dashboard: ${syncError.message}`);
        // Don't fail the approval if sync fails
      }
      
      // Send a follow-up message instead of replying
      try {
        await interaction.followUp({
          content: `You've approved LOA request ${loaId}.${roleAssigned ? ' LOA role has been assigned and will be automatically removed when the LOA ends.' : ' However, the LOA role could not be assigned automatically.'}`,
          ephemeral: true
        });
        console.log('Sent follow-up message to approver');
      } catch (followError) {
        console.error(`Error sending follow-up: ${followError.message}`);
        // We'll continue to try to DM the staff member
      }
      
      // Send DM to the staff member who requested LOA
      if (staffMember) {
        try {
          await staffMember.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('Your LOA Request was Approved')
                .setDescription(`Your leave of absence request (${loaId}) has been approved by ${interaction.user.tag}.${roleAssigned ? '\n\nAn LOA role has been assigned to you and will be automatically removed when your LOA ends.' : ''}`)
                .setTimestamp()
            ]
          });
          console.log(`Sent approval DM to ${staffMember.tag}`);
        } catch (error) {
          console.error(`Failed to send DM to user: ${error.message}`);
        }
      }
    } catch (error) {
      console.error(`Error in loa_approve handler: ${error.message}`);
      console.error(`Full error details: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: 'There was an error processing your request.', ephemeral: true });
        } else {
          await interaction.followUp({ content: 'There was an error processing your request.', ephemeral: true });
        }
      } catch (replyError) {
        console.error(`Failed to send error reply: ${replyError.message}`);
      }
    }
  },
  loa_deny: async (interaction, loaId) => {
    try {
      const member = interaction.member;
      const canManageStaffLoa = checkStaffLoaRole(member);
      
      if (!canManageStaffLoa) {
        return await interaction.reply({
          content: 'You need to have one of the authorized roles to deny Staff LOA requests.',
          ephemeral: true
        });
      }
      
      // First, defer the reply to buy us more time
      await interaction.deferUpdate();
      
      // Update the original embed
      const originalEmbed = interaction.message.embeds[0];
      
      // Find the staff member who submitted this LOA
      const staffMemberField = originalEmbed.fields.find(field => field.name === 'Staff Member');
      let staffMember = null;
      if (staffMemberField) {
        // Extract user ID from the mention format <@ID>
        const userIdMatch = staffMemberField.value.match(/<@(\d+)>/);
        if (userIdMatch && userIdMatch[1]) {
          staffMember = await interaction.client.users.fetch(userIdMatch[1]).catch(() => null);
        }
      }
      
      // Kopiere die Felder ohne Status-Felder
      const filteredFields = originalEmbed.fields?.filter(field => field.name !== 'Status') || [];
      
      // Erstelle ein neues Embed mit den gefilterten Feldern
      const updatedEmbed = EmbedBuilder.from(originalEmbed)
        .setColor(0xFF0000)
        .setFields(
          ...filteredFields,
          { name: 'Status', value: `\u274c Denied by ${interaction.user.tag}`, inline: true }
      );
      
      // Update the Discord message with the new embed
      await interaction.message.edit({ embeds: [updatedEmbed] });
      
      // Synchronize with dashboard database
      try {
        const { updateLoaStatus } = require('./utils/loa-sync-cjs');
        const updatedLoa = await updateLoaStatus(loaId, {
          approved: false,
          denied: true,
          updatedBy: interaction.user.username,
          updatedById: interaction.user.id
        });
        console.log(`LOA ${loaId} denied in dashboard by ${interaction.user.username}`);
        
        // Send IPC message to dashboard for real-time updates
        try {
          const { sendMessage } = require('./utils/ipc-cjs');
          sendMessage('loa_status_update', {
            loaId,
            action: 'deny',
            updatedBy: interaction.user.username,
            updatedById: interaction.user.id,
            timestamp: new Date().toISOString()
          });
          console.log(`LOA status update sent via IPC for ${loaId} (denied)`);
        } catch (ipcError) {
          console.error(`Error sending IPC message for LOA denial: ${ipcError.message}`);
          // Don't fail if IPC messaging fails
        }
      } catch (syncError) {
        console.error(`Error syncing LOA denial to dashboard: ${syncError.message}`);
        // Don't fail the denial if sync fails
      }
      
      // Send a follow-up message
      await interaction.followUp({
        content: `You've denied LOA request ${loaId}.`,
        ephemeral: true
      });
      
      // Send DM to the staff member who requested LOA
      if (staffMember) {
        try {
          await staffMember.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('Your LOA Request was Denied')
                .setDescription(`Your leave of absence request (${loaId}) has been denied by ${interaction.user.tag}.`)
                .setTimestamp()
            ]
          });
          console.log(`Sent denial DM to ${staffMember.tag}`);
        } catch (error) {
          console.error(`Failed to send DM to user: ${error.message}`);
        }
      }
    } catch (error) {
      console.error(`Error in loa_deny handler: ${error.message}`);
      console.error(`Full error details: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: 'There was an error processing your request.', ephemeral: true });
        } else {
          await interaction.followUp({ content: 'There was an error processing your request.', ephemeral: true });
        }
      } catch (replyError) {
        console.error(`Failed to send error reply: ${replyError.message}`);
      }
    }
  },
  loa_request_changes: async (interaction, loaId) => {
    const member = interaction.member;
    const canManageStaffLoa = checkStaffLoaRole(member);
    
    if (!canManageStaffLoa) {
      return interaction.reply({
        content: 'You need to have one of the authorized roles to request changes for Staff LOA requests.',
        ephemeral: true
      });
    }
    
    // Create a modal for requesting changes
    const modal = new ModalBuilder()
      .setCustomId(`loa_changes_modal_${loaId}`)
      .setTitle('Request LOA Changes');
      
    const changesInput = new TextInputBuilder()
      .setCustomId('requested_changes')
      .setLabel('Requested Changes')
      .setPlaceholder('Describe the changes needed for this LOA request...')
      .setStyle(TextInputStyle.Paragraph)
      .setMinLength(5)
      .setMaxLength(1000);
      
    const firstActionRow = new ActionRowBuilder().addComponents(changesInput);
    modal.addComponents(firstActionRow);
    
    await interaction.showModal(modal);
  },
};

// Helper functions for role checking
function checkStaffRole(member) {
  const teamId = process.env.TEAM_ID || '';
  const developerRoleId = '1370725982318891048'; // Developer role ID
  
  // Liste der erlaubten Rollen-IDs
  const allowedStaffRoleIds = [
    '1307038459915141263',   // Staff
    '1308042640926707733',   // Team
    '1307038465468403764',   // Admin
    '1370725982318891048',   // Developer
    '1307038473861071012'    // Neu hinzugefügte Rolle
  ];
  
  const roleNames = member.roles.cache.map(r => r.name).join(', ');
  const roleIds = [...member.roles.cache.keys()];
  
  console.log(`Checking staff role for user: ${member.user.tag}`);
  console.log(`Team ID configured: ${teamId}`);
  console.log(`Developer Role ID: ${developerRoleId}`);
  console.log(`User roles: ${roleNames}`);
  console.log(`User role IDs: ${roleIds.join(', ')}`);
  console.log(`Allowed Staff Role IDs: ${allowedStaffRoleIds.join(', ')}`);
  
  // Check for configured team role
  if (teamId && roleIds.includes(teamId)) {
    console.log('User has the configured team role!');
    return true;
  }
  
  // Prüfe auf explizit erlaubte Rollen-IDs
  for (const roleId of roleIds) {
    if (allowedStaffRoleIds.includes(roleId)) {
      console.log(`User has allowed staff role ID: ${roleId}`);
      return true;
    }
  }
  
  // Check for named staff roles
  const hasNamedRole = member.roles.cache.some(role => 
    ['Staff', 'Admin', 'Moderator', 'Helper', 'Trial Mod', 'Team', 'Developer'].includes(role.name));
  
  if (hasNamedRole) {
    console.log('User has a named staff role!');
    return true;
  } else {
    console.log('User does not have any staff roles.');
    return false;
  }
}

function checkAdminRole(member) {
  const adminRoles = ['Admin', 'Administrator', 'Owner'];
  return member.roles.cache.some(role => adminRoles.includes(role.name));
}

// Function to check if member can manage Staff LOAs
function checkStaffLoaRole(member) {
  const allowedStaffLoaRoles = [
    '1307038459915141263',
    '1308042640926707733', 
    '1307038465468403764',
    '1370725982318891048'
  ];
  
  const roleIds = [...member.roles.cache.keys()];
  const roleNames = member.roles.cache.map(r => r.name).join(', ');
  
  console.log(`Checking Staff LOA role for user: ${member.user.tag}`);
  console.log(`Allowed Staff LOA Role IDs: ${allowedStaffLoaRoles.join(', ')}`);
  console.log(`User roles: ${roleNames}`);
  console.log(`User role IDs: ${roleIds.join(', ')}`);
  
  const hasStaffLoaRole = roleIds.some(roleId => allowedStaffLoaRoles.includes(roleId));
  
  if (hasStaffLoaRole) {
    console.log('User has permission to manage Staff LOAs!');
    return true;
  } else {
    console.log('User does not have permission to manage Staff LOAs.');
    return false;
  }
}

// Register slash commands
const registerCommands = async () => {
  const commands = [];
  for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    commands.push(command.data.toJSON());
  }

  const rest = new REST().setToken(process.env.DISCORD_TOKEN);

  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
};

// When the client is ready, call the function
client.once(Events.ClientReady, c => {
  console.log(`Ready! Logged in as ${c.user.tag}`);
  registerCommands();
  
  // Check for expired LOAs and remove roles when bot starts
  checkExpiredLoas(client);
  
  // Also set up a periodic check for expired LOAs every hour
  setInterval(() => {
    checkExpiredLoas(client);
  }, 60 * 60 * 1000); // Check every hour
  
  // Initialize command counter
  client.commandCount = 0;
  
  // Start reporting stats to dashboard
  startStatsReporting(client, 10000); // Update every 10 seconds
  console.log('Bot stats reporting enabled');
});

// Handle command interactions
client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction);
      
      // Increment command counter for stats tracking
      incrementCommandCount(client);
    } catch (error) {
      console.error(error);
      
      // Überprüfen, ob die Fehlerbehandlung bereits erfolgt ist
      if (interaction.errorHandled) {
        console.log('Fehler wurde bereits in der Befehlsfunktion behandelt, überspringe globale Fehlerbehandlung');
        return;
      }
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
      } else {
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
      }
    }
  } else if (interaction.isButton()) {
    // Handle button interactions
    const customId = interaction.customId;
    
    // Handle changelog buttons
    if (customId.startsWith('changelog_')) {
      const commandName = 'changelog-create';
      const command = interaction.client.commands.get(commandName);
      
      if (command && command.buttons) {
        const buttonHandler = command.buttons[customId];
        
        if (buttonHandler) {
          try {
            await buttonHandler(interaction);
          } catch (error) {
            console.error(`Error handling changelog button ${customId}:`, error);
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({ 
                content: 'There was an error processing this button.', 
                ephemeral: true 
              });
            }
          }
          return;
        }
      }
    }
    
    // Parse the button ID to extract the action and ID
    const [action, id] = customId.split('_');
    const handlerId = `${action}_${id.split('-')[0]}`;
    
    console.log(`Button pressed: ${customId} (handler: ${handlerId})`);
    
    // Find the handler function for this button type
    let handler = null;
    
    if (handlerId === 'punish_approve') {
      handler = buttonHandlers.punish_approve;
    } else if (handlerId === 'punish_deny') {
      handler = buttonHandlers.punish_deny;
    } else if (handlerId === 'punish_escalate') {
      handler = buttonHandlers.punish_escalate;
    } else if (handlerId === 'bug_confirm') {
      handler = buttonHandlers.bug_confirm;
    } else if (handlerId === 'bug_fixed') {
      handler = buttonHandlers.bug_fixed;
    } else if (handlerId === 'bug_invalid') {
      handler = buttonHandlers.bug_invalid;
    } else if (handlerId === 'bug_duplicate') {
      handler = buttonHandlers.bug_duplicate;
    } else if (handlerId === 'bug_update') {
      handler = buttonHandlers.bug_update;
    } else if (handlerId === 'bug_subscribe') {
      handler = buttonHandlers.bug_subscribe;
    } else if (handlerId === 'suggestion_upvote') {
      handler = buttonHandlers.suggestion_upvote;
    } else if (handlerId === 'suggestion_downvote') {
      handler = buttonHandlers.suggestion_downvote;
    } else if (handlerId === 'suggestion_accept') {
      handler = buttonHandlers.suggestion_accept;
    } else if (handlerId === 'suggestion_reject') {
      handler = buttonHandlers.suggestion_reject;
    } else if (handlerId === 'approve_loa') {
      handler = buttonHandlers.loa_approve;
    } else if (handlerId === 'deny_loa') {
      handler = buttonHandlers.loa_deny;
    } else if (handlerId === 'modify_loa') {
      handler = buttonHandlers.loa_request_changes;
    }
    
    if (handler) {
      try {
        await handler(interaction, id);
      } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'There was an error while handling this interaction!', ephemeral: true });
      }
    } else {
      await interaction.reply({ content: 'This button functionality has not been implemented yet.', ephemeral: true });
    }
  } else if (interaction.isModalSubmit()) {
    // Handle changelog modal submissions
    if (interaction.customId.startsWith('changelog_add_')) {
      const commandName = 'changelog-create';
      const command = interaction.client.commands.get(commandName);
      
      if (command && command.handleModalSubmit) {
        try {
          await command.handleModalSubmit(interaction);
        } catch (error) {
          console.error(`Error handling changelog modal submit:`, error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
              content: 'There was an error processing your input.', 
              ephemeral: true 
            });
          }
        }
        return;
      }
    }
    
    // Handle other modal submissions
    const customId = interaction.customId;
    console.log(`Modal submitted: ${customId}`);
    
    // Handle status update modals
    if (customId.startsWith('status_update_modal_')) {
      const bugId = customId.replace('status_update_modal_', '');
      const updateContent = interaction.fields.getTextInputValue('status_update');
      
      const member = interaction.member;
      const isStaff = checkStaffRole(member);
      
      if (!isStaff) {
        return interaction.reply({
          content: 'You need to be a staff member to post status updates.',
          ephemeral: true
        });
      }
      
      // Post the update to the thread
      await interaction.reply({
        content: `**Status Update from ${interaction.user}:**\n\n${updateContent}`,
        embeds: [
          new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle(`Bug Status Update: ${bugId}`)
            .setDescription(updateContent)
            .setFooter({ text: `Status update by ${interaction.user.tag}` })
            .setTimestamp()
        ]
      });
    }
    // Handle suggestion rejection modals
    else if (customId.startsWith('suggestion_reject_modal_')) {
      const suggestionId = customId.replace('suggestion_reject_modal_', '');
      const rejectionReason = interaction.fields.getTextInputValue('rejection_reason');
      
      const member = interaction.member;
      const isStaff = checkStaffRole(member);
      
      if (!isStaff) {
        return interaction.reply({
          content: 'You need to be a staff member to reject suggestions.',
          ephemeral: true
        });
      }
      
      // Update the original embed
      const originalEmbed = interaction.message.embeds[0];
      const updatedEmbed = EmbedBuilder.from(originalEmbed)
        .setColor(0xFF0000)
        .addFields({ name: 'Status', value: `❌ Rejected by ${interaction.user.tag}`, inline: true })
        .addFields({ name: 'Rejection Reason', value: rejectionReason });
      
      await interaction.update({ embeds: [updatedEmbed] });
      
      await interaction.followUp({
        content: `You've rejected suggestion ${suggestionId} with reason: ${rejectionReason}`,
        ephemeral: true
      });
    }
    // Handle LOA change requests modals
    else if (customId.startsWith('loa_changes_modal_')) {
      const loaId = customId.replace('loa_changes_modal_', '');
      const requestedChanges = interaction.fields.getTextInputValue('requested_changes');
      
      const member = interaction.member;
      const canManageStaffLoa = checkStaffLoaRole(member);
      
      if (!canManageStaffLoa) {
        return interaction.reply({
          content: 'You need to have one of the authorized roles to request changes for Staff LOA requests.',
          ephemeral: true
        });
      }
      
      // Update the original embed
      const originalEmbed = interaction.message.embeds[0];
      
      // Find the staff member who submitted this LOA
      const staffMemberField = originalEmbed.fields.find(field => field.name === 'Staff Member');
      let staffMember = null;
      if (staffMemberField) {
        // Extract user ID from the mention format <@ID>
        const userIdMatch = staffMemberField.value.match(/<@(\d+)>/);
        if (userIdMatch && userIdMatch[1]) {
          staffMember = await interaction.client.users.fetch(userIdMatch[1]).catch(() => null);
        }
      }
      
      // Create updated embed with replaced status field and added requested changes field
      const updatedFields = originalEmbed.fields.map(field => {
        if (field.name === 'Status') {
          return { name: 'Status', value: `✋ Changes requested by ${interaction.user.tag}`, inline: field.inline };
        } else if (field.name === 'Requested Changes') {
          return null; // Remove existing requested changes field if present
        }
        return field;
      }).filter(field => field !== null); // Remove null entries
      
      // Add the requested changes field
      updatedFields.push({ name: 'Requested Changes', value: requestedChanges });
      
      const updatedEmbed = new EmbedBuilder()
        .setColor(0xFFA500) // Orange color
        .setTitle(originalEmbed.title)
        .setDescription(originalEmbed.description || '');
      
      // Add all fields from the mapped array
      updatedFields.forEach(field => updatedEmbed.addFields(field));
      
      // Set other properties if they exist
      if (originalEmbed.footer) updatedEmbed.setFooter({ text: originalEmbed.footer.text, iconURL: originalEmbed.footer.iconURL });
      if (originalEmbed.timestamp) updatedEmbed.setTimestamp(originalEmbed.timestamp);
      if (originalEmbed.thumbnail) updatedEmbed.setThumbnail(originalEmbed.thumbnail.url);
      
      await interaction.update({ embeds: [updatedEmbed] });
      
      await interaction.followUp({
        content: `You've requested changes for LOA request ${loaId}:\n${requestedChanges}`,
        ephemeral: true
      });
      
      // Send DM to the staff member who requested LOA
      if (staffMember) {
        try {
          await staffMember.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0xFFA500) // Orange color
                .setTitle('Changes Requested for Your LOA')
                .setDescription(`Your leave of absence request (${loaId}) needs some changes requested by ${interaction.user.tag}.`)
                .addFields({ name: 'Requested Changes', value: requestedChanges })
                .setTimestamp()
            ]
          });
          console.log(`Sent changes request DM to ${staffMember.tag}`);
        } catch (error) {
          console.error(`Failed to send DM to user: ${error.message}`);
        }
      }
    }
  }
});

// Log in to Discord
client.login(process.env.DISCORD_TOKEN);
