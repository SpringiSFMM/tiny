const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bug')
    .setDescription('Report a bug')
    .addStringOption(option => 
      option.setName('realm')
        .setDescription('The realm where the bug was found')
        .setRequired(true)
        .addChoices(
          { name: 'boxpvp', value: 'boxpvp' },
          { name: 'lifesteal', value: 'lifesteal' },
          { name: 'hub', value: 'hub' },
          { name: 'network', value: 'network' },
          { name: 'Other', value: 'other' }
        ))
    .addStringOption(option => 
      option.setName('title')
        .setDescription('A short title for the bug report')
        .setMaxLength(100)
        .setRequired(true))
    .addStringOption(option => 
      option.setName('date')
        .setDescription('The date when the bug was encountered (YYYY-MM-DD)')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('explanation')
        .setDescription('Detailed explanation of the bug')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('severity')
        .setDescription('How severe is this bug?')
        .addChoices(
          { name: 'Low - Minor inconvenience', value: 'low' },
          { name: 'Medium - Affects functionality', value: 'medium' },
          { name: 'High - Breaks important features', value: 'high' },
          { name: 'Critical - Game breaking/crashes', value: 'critical' }
        )
        .setRequired(false))
    .addStringOption(option =>
      option.setName('steps')
        .setDescription('Steps to reproduce the bug (optional)')
        .setRequired(false))
    .addAttachmentOption(option =>
      option.setName('screenshot')
        .setDescription('Screenshot of the bug (optional)')
        .setRequired(false)),
  
  async execute(interaction) {
    // Get the options
    const realm = interaction.options.getString('realm');
    const date = interaction.options.getString('date');
    const title = interaction.options.getString('title');
    const explanation = interaction.options.getString('explanation');
    const steps = interaction.options.getString('steps') || 'No steps provided';
    const severity = interaction.options.getString('severity') || 'medium';
    const screenshot = interaction.options.getAttachment('screenshot');
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return interaction.reply({
        content: 'Invalid date format. Please use YYYY-MM-DD format.',
        ephemeral: true
      });
    }
    
    // Generate bug ID
    const bugId = `BUG-${Math.floor(Date.now() / 1000).toString(36).toUpperCase()}`;
    
    // Validate screenshot if provided
    if (screenshot) {
      const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!validImageTypes.includes(screenshot.contentType)) {
        return interaction.reply({
          content: 'Please upload a valid image file as screenshot. Supported formats: JPG, PNG, GIF, WEBP.',
          ephemeral: true
        });
      }
    }
    
    // Define severity details
    const severityInfo = {
      'low': { color: 0x00FF00, emoji: '🟢', text: 'Low' },
      'medium': { color: 0xFFFF00, emoji: '🟡', text: 'Medium' },
      'high': { color: 0xFFA500, emoji: '🟠', text: 'High' },
      'critical': { color: 0xFF0000, emoji: '🔴', text: 'Critical' }
    };
    
    // Get realm info
    const realmInfo = getRealmInfo(realm);
    
    // Create the embed
    const embed = new EmbedBuilder()
      .setColor(severityInfo[severity].color)
      .setTitle(`Bug Report: ${title}`)
      .addFields(
        { name: 'Bug ID', value: bugId, inline: true },
        { name: 'Realm', value: `${realmInfo.emoji} ${realmInfo.name}`, inline: true },
        { name: 'Severity', value: `${severityInfo[severity].emoji} ${severityInfo[severity].text}`, inline: true },
        { name: 'Date Encountered', value: formatDate(date), inline: true },
        { name: 'Reported by', value: interaction.user.toString(), inline: true },
        { name: 'Status', value: '⏳ Pending Investigation', inline: true },
        { name: 'Bug Description', value: explanation },
        { name: 'Steps to Reproduce', value: steps }
      )
      .setTimestamp()
      .setFooter({ text: `Bug Report System • ID: ${bugId}` });
    
    // Add screenshot if provided
    if (screenshot) {
      embed.setImage(screenshot.url);
    }

    // Create the buttons
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`bug_confirm_${bugId}`)
        .setLabel('Confirm Bug')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔍'),
      new ButtonBuilder()
        .setCustomId(`bug_fixed_${bugId}`)
        .setLabel('Mark as Fixed')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId(`bug_invalid_${bugId}`)
        .setLabel('Invalid')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌'),
      new ButtonBuilder()
        .setCustomId(`bug_duplicate_${bugId}`)
        .setLabel('Duplicate')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔄')
    );
    
    // Send the embed
    const message = await interaction.reply({ 
      embeds: [embed], 
      components: [buttons],
      fetchReply: true 
    });
    
    // Create a thread for this bug report
    const thread = await message.startThread({
      name: `Bug: ${title}`,
      autoArchiveDuration: 10080, // Archive after 7 days
      reason: `Thread for bug report ${bugId}`
    });
    
    // Send initial message in thread
    await thread.send({
      content: `This thread has been created to track bug **${title}** (${bugId}).\n\n**Staff**: Please use this thread to discuss the bug and post updates.\n**${interaction.user}**: Please provide any additional information about the bug here if needed.`,
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`bug_update_${bugId}`)
            .setLabel('Post Status Update')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📝'),
          new ButtonBuilder()
            .setCustomId(`bug_subscribe_${bugId}`)
            .setLabel('Subscribe to Updates')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔔')
        )
      ]
    });

    // Auto-join the thread
    if (thread.joinable) await thread.join();
  },
};

// Helper functions
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

function getRealmInfo(realm) {
  const realmInfoMap = {
    'boxpvp': { name: 'boxpvp', color: 0x00AA00, emoji: '🥊' },
    'lifesteal': { name: 'lifesteal', color: 0x00AA00, emoji: '❤️' },
    'hub': { name: 'hub', color: 0x00AA00, emoji: '🏠' },
    'network': { name: 'network', color: 0x00AA00, emoji: '🌐' },
    'other': { name: 'Other', color: 0xAAAAAA, emoji: '❓' }
  };
  
  return realmInfoMap[realm] || { name: realm, color: 0xFF5733, emoji: '🔧' };
}
