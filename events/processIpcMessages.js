const { Events, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { updateLoaStatus, getLoaById, getLoaMessageId, storeLoaMessageId } = require('../utils/loa-sync-cjs');
const { sendLoaToDiscord, sendChangelogToDiscord } = require('../utils/dashboard-integration');
const { processMessages } = require('../utils/ipc-cjs');

// Use a global variable to track if the handler is initialized
let handlerInitialized = false;

module.exports = {
  name: Events.ClientReady,
  once: true, // This is crucial - only execute once when bot is ready
  async execute(client) {
    console.log('Initializing IPC message handler');
    
    // Initial processing
    await checkForMessages(client);
    
    // Set up interval to check for messages every 30 seconds
    setInterval(async () => {
      await checkForMessages(client);
    }, 30 * 1000);
  }
};

/**
 * Handle LOA update messages from the dashboard
 * @param {Client} client - The Discord client
 * @param {Object} data - The LOA update data
 */
async function handleLoaUpdate(client, data) {
  try {
    const { loaId, action, loa, updatedBy, updatedById } = data;
    
    // Get the complete LOA information if not provided or missing userId
    let completeLoaData = loa;
    let userId = loa?.userId;
    
    // If we don't have complete LOA data or userId, try to get it from the file
    if (!userId) {
      try {
        completeLoaData = await getLoaById(loaId);
        userId = completeLoaData?.userId;
        console.log(`Retrieved LOA data from file for ${loaId}:`, completeLoaData ? 'Success' : 'Not found');
      } catch (loaErr) {
        console.error(`Failed to retrieve complete LOA data for ${loaId}:`, loaErr);
      }
    }
    
    // Send a DM to the user affected by the LOA update if we have their userId
    if (userId) {
      try {
        console.log(`Attempting to send DM to user ID: ${userId} for LOA ${loaId}`);
        
        // Fetch the user with force refresh to ensure we have latest data
        const user = await client.users.fetch(userId, { force: true });
        
        if (!user) {
          console.error(`Failed to fetch user ${userId} for DM notification`);
          return;
        }
        
        console.log(`Successfully fetched user: ${user.tag} (${user.id}) for DM notification`);
        
        // Create an embed for the DM with more visible notification
        const dmEmbed = new EmbedBuilder()
          .setTitle(`🔔 LOA Status Update`)
          .setTimestamp();

        // Set color and content based on action
        switch (action) {
          case 'approve':
            dmEmbed.setColor('#00FF00')
              .setDescription(`Your Leave of Absence request (ID: ${loaId}) has been **approved** by ${updatedBy} via the Dashboard.`);
            break;
          case 'deny':
            dmEmbed.setColor('#FF0000')
              .setDescription(`Your Leave of Absence request (ID: ${loaId}) has been **denied** by ${updatedBy} via the Dashboard.`);
            break;
          case 'delete':
            dmEmbed.setColor('#808080')
              .setDescription(`Your Leave of Absence request (ID: ${loaId}) has been **deleted** by ${updatedBy} via the Dashboard.`);
            break;
          default:
            dmEmbed.setColor('#3498DB')
              .setDescription(`Your Leave of Absence request (ID: ${loaId}) has been updated by ${updatedBy} via the Dashboard.`);
        }

        // Add LOA details to the embed if available
        if (action !== 'delete' && completeLoaData) {
          // Format dates
          const startDate = new Date(completeLoaData.startDate).toLocaleDateString();
          const endDate = new Date(completeLoaData.endDate).toLocaleDateString();
          
          dmEmbed.addFields(
            { name: 'Type', value: completeLoaData.type ? completeLoaData.type.charAt(0).toUpperCase() + completeLoaData.type.slice(1) : 'Not specified', inline: true },
            { name: 'Duration', value: `${startDate} to ${endDate}`, inline: true },
            { name: 'Status', value: completeLoaData.approved ? '✅ Approved' : '❌ Denied', inline: true }
          );
        }
        
        // Add a timestamp to make the notification more visible
        dmEmbed.setFooter({ text: `Dashboard LOA System - ${new Date().toLocaleTimeString()}` });

        // Send the DM with explicit notification content
        const dmMessage = await user.send({ 
          content: `**NOTIFICATION:** Your Leave of Absence status has been updated!`, 
          embeds: [dmEmbed] 
        });
        
        if (dmMessage) {
          console.log(`Successfully sent LOA update DM to ${user.tag} for LOA ${loaId}`);
        } else {
          console.error(`Failed to send DM to ${user.tag}, message object was null`);
        }
      } catch (dmError) {
        console.error(`Error sending DM to user ${userId} for LOA ${loaId}:`, dmError);
        if (dmError.code === 50007) {
          console.log(`User ${userId} has DMs disabled or cannot receive DMs from this bot`);
        }
        // Continue with message update even if DM fails
      }
    }
    
    // Get the message ID for the LOA in Discord
    const messageId = await getLoaMessageId(loaId);
    if (!messageId) {
      console.log(`No Discord message found for LOA ${loaId}`);
      return;
    }
    
    // Get the LOA channel
    const loaChannel = client.channels.cache.get('1307038560226119731'); // LOA channel ID
    if (!loaChannel) {
      console.error('LOA channel not found');
      return;
    }
    
    // Try to fetch the message
    try {
      const message = await loaChannel.messages.fetch(messageId);
      
      if (!message) {
        console.error(`LOA message ${messageId} not found`);
        return;
      }
      
      // Update the message based on the action
      switch (action) {
        case 'approve':
          // Update the message embed with approved status
          const embedApprove = message.embeds[0];
          const newEmbedApprove = EmbedBuilder.from(embedApprove)
            .setColor('#00FF00') // Green for approved
            .setDescription(`**Status:** Approved by ${updatedBy} (via Dashboard)`);
          
          // Remove buttons when approved from dashboard
          await message.edit({ embeds: [newEmbedApprove], components: [] });
          break;
          
        case 'deny':
          // Update the message embed with denied status
          const embedDeny = message.embeds[0];
          const newEmbedDeny = EmbedBuilder.from(embedDeny)
            .setColor('#FF0000') // Red for denied
            .setDescription(`**Status:** Denied by ${updatedBy} (via Dashboard)`);
          
          // Remove buttons when denied from dashboard
          await message.edit({ embeds: [newEmbedDeny], components: [] });
          break;
          
        case 'delete':
          // Delete the message from Discord
          await message.delete();
          break;
          
        default:
          console.log(`Unknown LOA action: ${action}`);
      }
      
      console.log(`Successfully updated Discord message for LOA ${loaId}`);
      
    } catch (error) {
      console.error(`Error updating Discord message for LOA ${loaId}:`, error);
    }
  } catch (error) {
    console.error('Error handling LOA update:', error);
  }
}

async function checkForMessages(client) {
  try {
    const processed = await processMessages(async (type, data) => {
      try {
        console.log(`Processing IPC message of type: ${type}`);
        
        if (type === 'changelog') {
          await sendChangelogToDiscord(client, data);
          console.log('Sent changelog to Discord channel');
          return true;
        } else if (type === 'loa') {
          // Send notification message to Discord channel
          const sentMessage = await sendLoaToDiscord(client, data);
          console.log(`Sent LOA request for <@${data.userId}> to Discord channel`);
          
          // Store the mapping between LOA ID and Discord message ID
          if (sentMessage && sentMessage.id) {
            await storeLoaMessageId(data.id, sentMessage.id);
          }
          
          // Send a DM notification to the user about their LOA submission
          try {
            const user = await client.users.fetch(data.userId);
            if (user) {
              // Create an embed for the DM
              const dmEmbed = new EmbedBuilder()
                .setTitle(`LOA Submission Received`)
                .setColor('#3498DB')
                .setDescription(`Your Leave of Absence request (ID: ${data.id}) has been submitted via the Dashboard and is awaiting staff approval.`)
                .setTimestamp();
                
              // Add LOA details
              const startDate = new Date(data.startDate).toLocaleDateString();
              const endDate = new Date(data.endDate).toLocaleDateString();
              
              dmEmbed.addFields(
                { name: 'Type', value: data.type ? data.type.charAt(0).toUpperCase() + data.type.slice(1) : 'Not specified', inline: true },
                { name: 'Duration', value: `${startDate} to ${endDate}`, inline: true },
                { name: 'Status', value: '⏳ Pending Approval', inline: true }
              );
              
              // Send the DM
              await user.send({ embeds: [dmEmbed] });
              console.log(`Sent LOA submission notification DM to ${user.tag}`);
            }
          } catch (dmError) {
            console.error(`Error sending DM to user ${data.userId}:`, dmError);
            // Continue processing even if DM fails
          }
          
          return true;
        } else if (type === 'loa_update') {
          // Handle LOA updates from dashboard
          await handleLoaUpdate(client, data);
          console.log(`Processed LOA update for ${data.loaId}`);
          return true;
        } else {
          console.warn(`Unknown IPC message type: ${type}`);
          return false;
        }
      } catch (error) {
        console.error('Error processing IPC message:', error);
      }
    });
    
    if (processed > 0) {
      console.log(`Processed ${processed} IPC messages`);
    }
  } catch (error) {
    console.error('Error processing IPC messages:', error);
  }
}
