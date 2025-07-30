import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EmbedBuilder } from 'discord.js';

// Get directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Channel IDs for notifications
const CHANGELOG_CHANNEL_ID = '1307038573567934615';
const LOA_CHANNEL_ID = '1307038560226119731';

/**
 * Send a changelog to the changelog channel
 * @param {object} client - Discord client
 * @param {object} changelog - Changelog data
 */
async function sendChangelogToDiscord(client, changelog) {
  try {
    const channel = await client.channels.fetch(CHANGELOG_CHANNEL_ID);
    if (!channel) {
      console.error(`Changelog channel ${CHANGELOG_CHANNEL_ID} not found`);
      return;
    }

    // Create fields for each change
    const changeFields = changelog.changes.map(change => {
      const emojis = {
        added: '🟢',
        changed: '🔵',
        fixed: '🟠',
        removed: '🔴'
      };
      
      const emoji = emojis[change.type] || '⚪';
      return {
        name: `${emoji} ${change.type.charAt(0).toUpperCase() + change.type.slice(1)}`,
        value: change.description,
        inline: false
      };
    });

    // Create embed
    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle(`v${changelog.version} - ${changelog.title}`)
      .setDescription(changelog.description || 'No description provided')
      .addFields(changeFields)
      .setFooter({ text: `Created by ${changelog.createdBy || 'Unknown'}` })
      .setTimestamp(new Date(changelog.date));

    await channel.send({ embeds: [embed] });
    console.log(`Sent changelog v${changelog.version} to Discord channel`);
    return true;
  } catch (error) {
    console.error('Error sending changelog to Discord:', error);
    return false;
  }
}

/**
 * Send a LOA notification to the LOA channel
 * @param {object} client - Discord client
 * @param {object} loa - LOA data
 */
async function sendLoaToDiscord(client, loa) {
  try {
    const channel = await client.channels.fetch(LOA_CHANNEL_ID);
    if (!channel) {
      console.error(`LOA channel ${LOA_CHANNEL_ID} not found`);
      return;
    }
    
    // Get user by ID if available
    let userMention = 'Unknown User';
    if (loa.userId) {
      try {
        const user = await client.users.fetch(loa.userId);
        userMention = user ? `<@${user.id}>` : `User ID: ${loa.userId}`;
      } catch (err) {
        console.error('Error fetching user:', err);
        userMention = `User ID: ${loa.userId}`;
      }
    }

    // Format dates
    const startDate = new Date(loa.startDate).toLocaleDateString();
    const endDate = new Date(loa.endDate).toLocaleDateString();
    
    // Create embed color based on type
    let color = 0x3498DB; // Default blue
    if (loa.type === 'medical') color = 0xE74C3C; // Red
    else if (loa.type === 'vacation') color = 0x2ECC71; // Green
    else if (loa.type === 'personal') color = 0xF1C40F; // Yellow

    // Create embed
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`Staff Leave of Absence - ${loa.type.charAt(0).toUpperCase() + loa.type.slice(1)}`)
      .setDescription(`A new LOA request has been submitted through the dashboard.`)
      .addFields(
        { name: 'Staff Member', value: userMention, inline: true },
        { name: 'Type', value: loa.type.charAt(0).toUpperCase() + loa.type.slice(1), inline: true },
        { name: 'Duration', value: `${startDate} to ${endDate}`, inline: true },
        { name: 'Reason', value: loa.isPrivate ? '*Private reason*' : loa.reason || 'No reason provided' }
      );
      
    // Add contact info if provided
    if (loa.contact) {
      embed.addFields({ name: 'Contact', value: loa.contact });
    }
    
    embed.addFields({ name: 'Status', value: '⏳ Pending' })
      .setFooter({ text: `LOA ID: ${loa.id}` })
      .setTimestamp();

    // Create action buttons
    const approveButton = {
      type: 2,
      style: 3, // Green
      label: 'Approve',
      custom_id: `approve_loa_${loa.id}`
    };
    
    const denyButton = {
      type: 2,
      style: 4, // Red
      label: 'Deny',
      custom_id: `deny_loa_${loa.id}`
    };
    
    const modifyButton = {
      type: 2,
      style: 1, // Blue
      label: 'Request Changes',
      custom_id: `modify_loa_${loa.id}`
    };
    
    const actionRow = {
      type: 1,
      components: [approveButton, denyButton, modifyButton]
    };

    const sentMessage = await channel.send({ 
      embeds: [embed],
      components: [actionRow]
    });
    
    console.log(`Sent LOA request for ${userMention} to Discord channel - Message ID: ${sentMessage.id}`);
    return sentMessage;
  } catch (error) {
    console.error('Error sending LOA to Discord:', error);
    return false;
  }
}

export {
  sendChangelogToDiscord,
  sendLoaToDiscord
};
