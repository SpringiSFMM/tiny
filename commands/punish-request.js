const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const dotenv = require('dotenv');

// Ensure environment variables are loaded
dotenv.config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('punish-request')
    .setDescription('Submit a punishment request for a player')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addStringOption(option => 
      option.setName('nickname')
        .setDescription('The nickname of the player to punish')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('offense')
        .setDescription('The offense committed by the player')
        .setRequired(true)
        .addChoices(
          { name: 'Griefing', value: 'griefing' },
          { name: 'Hacking/Cheating', value: 'hacking' },
          { name: 'Inappropriate Language', value: 'inappropriate_language' },
          { name: 'Harassment', value: 'harassment' },
          { name: 'Other', value: 'other' }
        ))
    .addStringOption(option => 
      option.setName('proof_url')
        .setDescription('URL link to proof of the offense (screenshot or video)')
        .setRequired(false))
    .addAttachmentOption(option => 
      option.setName('proof_file')
        .setDescription('Upload a file as proof of the offense (screenshot or video)')
        .setRequired(false))
    .addStringOption(option => 
      option.setName('offense_details')
        .setDescription('Additional details about the offense')
        .setRequired(false))
    .addStringOption(option => 
      option.setName('severity')
        .setDescription('How severe is this offense?')
        .setRequired(false)
        .addChoices(
          { name: 'Minor', value: 'minor' },
          { name: 'Moderate', value: 'moderate' },
          { name: 'Severe', value: 'severe' },
          { name: 'Critical', value: 'critical' }
        )),
  
  async execute(interaction) {
    // Check if the user has the staff role
    const member = interaction.member;
    
    // Check for specific allowed role IDs
    const allowedRoleIds = [
      '1307038459915141263',  // Staff role ID
      '1308042640926707733',  // Team role ID
      '1307038465468403764',  // Admin role ID
      '1370725982318891048'   // Developer role ID
    ];
    
    // Check if user has any of the allowed roles
    const hasStaffRole = member.roles.cache.some(role => allowedRoleIds.includes(role.id)) || 
                        member.permissions.has(PermissionFlagsBits.Administrator);
    
    console.log(`Punish-request permission check for ${member.user.tag}:`, {
      roles: member.roles.cache.map(r => ({ id: r.id, name: r.name })),
      hasStaffRole
    });
    
    // Deny access if the user doesn't have the required role
    if (!hasStaffRole) {
      return interaction.reply({ 
        content: 'You do not have permission to use this command. This command is for staff only.', 
        ephemeral: true 
      });
    }
    
    // Get the options
    const nickname = interaction.options.getString('nickname');
    const offense = interaction.options.getString('offense');
    const offenseDetails = interaction.options.getString('offense_details') || 'No additional details provided';
    const severity = interaction.options.getString('severity') || 'Not specified';
    const proofUrl = interaction.options.getString('proof_url');
    const proofFile = interaction.options.getAttachment('proof_file');
    
    // Check that at least one proof option is provided
    if (!proofUrl && !proofFile) {
      return interaction.reply({ 
        content: 'Please provide either a URL link or upload a file as proof.',
        ephemeral: true 
      });
    }
    
    // If a file is provided, check if it's a valid image or video
    if (proofFile) {
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/quicktime', 'image/webp'];
      if (!validTypes.includes(proofFile.contentType)) {
        return interaction.reply({ 
          content: 'Please upload a valid image or video file as proof. Supported formats: JPG, PNG, GIF, MP4, MOV, WEBP.',
          ephemeral: true 
        });
      }
    }
    
    // If a URL is provided, check if it looks like a valid URL
    if (proofUrl) {
      try {
        new URL(proofUrl); // This will throw an error if the URL is invalid
      } catch (error) {
        return interaction.reply({ 
          content: 'Please provide a valid URL for the proof.',
          ephemeral: true 
        });
      }
    }

    // Severity colors
    const severityColors = {
      'minor': 0xFFFF00,      // Yellow
      'moderate': 0xFFA500,   // Orange
      'severe': 0xFF0000,     // Red
      'critical': 0x800000,   // Dark red
      'Not specified': 0xFF0000 // Default red
    };
    
    // Create the embed
    // Create the embed fields array
    const embedFields = [
      { name: 'Player', value: nickname, inline: true },
      { name: 'Offense Type', value: offenseToText(offense), inline: true },
      { name: 'Severity', value: severityToText(severity), inline: true },
      { name: 'Requested by', value: interaction.user.tag, inline: false },
      { name: 'Details', value: offenseDetails },
      { name: 'Date', value: new Date().toISOString().split('T')[0], inline: true },
      { name: 'Time', value: new Date().toTimeString().split(' ')[0], inline: true }
    ];
    
    // Add proof URL as a field if provided
    if (proofUrl) {
      embedFields.push({ name: 'Proof URL', value: proofUrl, inline: false });
    }
    
    const embed = new EmbedBuilder()
      .setColor(severityColors[severity])
      .setTitle('Punishment Request')
      .addFields(embedFields)
      .setImage(proofFile ? proofFile.url : null)
      .setTimestamp()
      .setFooter({ text: 'Punishment Request System • Case ID: ' + generateCaseId() });
    
    // Create a unique case ID for this punishment request
    const caseId = generateCaseId();
    
    // Update the embed footer with the case ID
    embed.setFooter({ text: `Punishment Request System • Case ID: ${caseId}` });
    
    // Create action row with buttons
    const actionRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`punish_approve-${caseId}`)
          .setLabel('Approve')
          .setStyle(3), // Success (green)
        new ButtonBuilder()
          .setCustomId(`punish_deny-${caseId}`)
          .setLabel('Deny')
          .setStyle(4), // Danger (red)
        new ButtonBuilder()
          .setCustomId(`punish_escalate-${caseId}`)
          .setLabel('Escalate')
          .setStyle(1), // Primary (blue)
      );
    
    // Get the punishment request channel ID from env or use a default
    const punishmentChannelId = process.env.PUNISHMENT_CHANNEL_ID || interaction.channelId;
    
    let punishmentChannel;
    try {
      // Try to get the punishment channel
      punishmentChannel = await interaction.guild.channels.fetch(punishmentChannelId);
    } catch (error) {
      console.error(`Error fetching punishment channel: ${error.message}`);
      punishmentChannel = interaction.channel;
    }
    
    // Reply to the user that the request has been submitted
    await interaction.reply({
      content: 'Your punishment request has been submitted successfully.',
      ephemeral: true
    });
    
    // Send the punishment request to the designated channel
    const message = await punishmentChannel.send({
      embeds: [embed],
      components: [actionRow]
    });
    
    // Create a thread for discussion
    const thread = await message.startThread({
      name: `Punishment Request: ${nickname}`,
      autoArchiveDuration: 1440, // Archive after 24 hours
      reason: `Punishment request discussion for ${nickname}`
    });
    
    // Send initial message in thread
    await thread.send({
      content: `This thread has been created to discuss the punishment request for **${nickname}**. Please provide any additional information here.\n\nSubmitted by: ${interaction.user}`,
    });
    
    console.log(`Punishment request created with Case ID: ${caseId} by ${interaction.user.tag}`)
  },
};

// Helper functions
function offenseToText(offense) {
  const offenses = {
    'griefing': 'Griefing',
    'hacking': 'Hacking/Cheating',
    'inappropriate_language': 'Inappropriate Language',
    'harassment': 'Harassment',
    'other': 'Other'
  };
  
  return offenses[offense] || offense;
}

function severityToText(severity) {
  const severities = {
    'minor': '⚠️ Minor',
    'moderate': '⚠️⚠️ Moderate',
    'severe': '⚠️⚠️⚠️ Severe',
    'critical': '☢️ Critical',
    'Not specified': 'Not specified'
  };
  
  return severities[severity] || severity;
}

function generateCaseId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
