const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('suggestion')
    .setDescription('Submit a suggestion for a realm')
    .addStringOption(option => 
      option.setName('realm')
        .setDescription('The realm for which the suggestion is being made')
        .setRequired(true)
        .addChoices(
          { name: 'Survival', value: 'survival' },
          { name: 'Creative', value: 'creative' },
          { name: 'Skyblock', value: 'skyblock' },
          { name: 'Minigames', value: 'minigames' },
          { name: 'Discord', value: 'discord' },
          { name: 'Website', value: 'website' },
          { name: 'General', value: 'general' }
        ))
    .addStringOption(option => 
      option.setName('suggestion_title')
        .setDescription('A brief title for your suggestion')
        .setRequired(true)
        .setMaxLength(100))
    .addStringOption(option => 
      option.setName('suggestion')
        .setDescription('Your detailed suggestion')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('category')
        .setDescription('What category does your suggestion fall under?')
        .addChoices(
          { name: 'Lifesteal', value: 'lifesteal' },
          { name: 'Events', value: 'events' },
          { name: 'BoxPvP', value: 'boxpvp' }
        )
        .setRequired(false))
    .addAttachmentOption(option =>
      option.setName('image')
        .setDescription('Optional image to help explain your suggestion')
        .setRequired(false)),
  
  async execute(interaction) {
    // Get the options
    const realm = interaction.options.getString('realm');
    const suggestionTitle = interaction.options.getString('suggestion_title');
    const suggestion = interaction.options.getString('suggestion');
    const category = interaction.options.getString('category') || 'Not specified';
    const image = interaction.options.getAttachment('image');
    
    // Generate a random ID for the suggestion
    const suggestionId = `S-${Math.floor(Date.now() / 1000).toString(36).toUpperCase()}`;
    
    // Get realm color and icon
    const realmInfo = getRealmInfo(realm);
    
    // Create the embed
    const embed = new EmbedBuilder()
      .setColor(realmInfo.color)
      .setTitle(`Suggestion: ${suggestionTitle}`)
      .setDescription(`${suggestion}`)
      .addFields(
        { name: 'Realm', value: `${realmInfo.emoji} ${realmInfo.name}`, inline: true },
        { name: 'Category', value: getCategoryText(category), inline: true },
        { name: 'Suggested by', value: interaction.user.tag, inline: true },
        { name: 'Status', value: '📊 Voting In Progress', inline: true },
        { name: 'Suggestion ID', value: suggestionId, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: `Suggestion System • Use /vote ${suggestionId} [yes/no] to vote` });
    
    // If an image was provided, add it
    if (image) {
      const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      
      if (validImageTypes.includes(image.contentType)) {
        embed.setImage(image.url);
      } else {
        return interaction.reply({
          content: 'Please upload a valid image file. Supported formats: JPG, PNG, GIF, WEBP.',
          ephemeral: true
        });
      }
    }
    
    // Send the embed
    const message = await interaction.reply({ 
      embeds: [embed], 
      fetchReply: true,
      components: [
        {
          type: 1, // ActionRow
          components: [
            {
              type: 2, // Button
              style: 3, // Success (green)
              custom_id: `suggestion_upvote_${suggestionId}`,
              label: '👍 Upvote',
              emoji: '👍'
            },
            {
              type: 2, // Button
              style: 4, // Danger (red)
              custom_id: `suggestion_downvote_${suggestionId}`,
              label: '👎 Downvote',
              emoji: '👎'
            },
            {
              type: 2, // Button
              style: 1, // Primary (blue)
              custom_id: `comment_${suggestionId}`,
              label: '💬 Comment',
              emoji: '💬'
            }
          ]
        },
        {
          type: 1, // ActionRow
          components: [
            {
              type: 2, // Button
              style: 3, // Success (green)
              custom_id: `suggestion_accept_${suggestionId}`,
              label: '✅ Accept',
              emoji: '✅'
            },
            {
              type: 2, // Button
              style: 4, // Danger (red)
              custom_id: `suggestion_reject_${suggestionId}`,
              label: '❌ Reject',
              emoji: '❌'
            }
          ]
        }
      ]
    });
    
    // Create a thread for discussion of this suggestion
    const thread = await message.startThread({
      name: `Suggestion: ${suggestionTitle}`,
      autoArchiveDuration: 10080, // Archive after 7 days
      reason: `Thread for discussing suggestion: ${suggestionTitle}`
    });
    
    // Send an initial message in the thread
    await thread.send(`This thread has been created to discuss the suggestion by ${interaction.user}. Please keep the discussion related to this suggestion!`);

    // Auto track thread
    if (thread.joinable) await thread.join();
    
    // Add reactions for voting (these work for mobile users who can't use buttons)
    await message.react('👍');
    await message.react('👎');
    await message.react('💬');
  },
};

// Helper functions
function getRealmInfo(realm) {
  const realmInfoMap = {
    'survival': { name: 'Survival', color: 0x00AA00, emoji: '🌳' },
    'creative': { name: 'Creative', color: 0x5555FF, emoji: '🏗️' },
    'skyblock': { name: 'Skyblock', color: 0x55AAFF, emoji: '🏝️' },
    'minigames': { name: 'Minigames', color: 0xFF55FF, emoji: '🎮' },
    'discord': { name: 'Discord', color: 0x5865F2, emoji: '🎭' },
    'website': { name: 'Website', color: 0xFFAA00, emoji: '🌐' },
    'general': { name: 'General', color: 0xAAAAAA, emoji: '📌' }
  };
  
  return realmInfoMap[realm] || { name: realm, color: 0x00FFFF, emoji: '🔧' };
}

function getCategoryText(category) {
  const categories = {
    'gameplay': '🎲 Gameplay Feature',
    'uiux': '📱 UI/UX',
    'events': '🎉 Events',
    'rules': '📜 Rules/Moderation',
    'technical': '⚙️ Technical',
    'other': '❓ Other',
    'Not specified': '❓ Not specified'
  };
  
  return categories[category] || category;
}
