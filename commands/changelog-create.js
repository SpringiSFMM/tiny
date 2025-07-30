const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');

// Developer ID für Berechtigungsprüfung
const DEVELOPER_ID = '563877348173414454';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('changelog-create')
    .setDescription('Interactive changelog embed builder [Developer only]')
    .addStringOption(option => 
      option.setName('title')
        .setDescription('Title of the changelog')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('description')
        .setDescription('Brief description of the changelog')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('version')
        .setDescription('Version number (e.g. 1.0.0)')
        .setRequired(true))
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to post the changelog')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('color')
        .setDescription('Color of the embed (hex code or common color name)')
        .setRequired(false)
        .addChoices(
          { name: 'Blue', value: '#3498db' },
          { name: 'Green', value: '#2ecc71' },
          { name: 'Red', value: '#e74c3c' },
          { name: 'Purple', value: '#9b59b6' },
          { name: 'Orange', value: '#e67e22' },
          { name: 'Yellow', value: '#f1c40f' },
          { name: 'Cyan', value: '#1abc9c' },
          { name: 'Default', value: '#2f3136' }
        )),

  async execute(interaction) {
    // Check if the user is the developer
    if (interaction.user.id !== DEVELOPER_ID) {
      return interaction.reply({ 
        content: 'This command is only available for the bot developer.', 
        ephemeral: true 
      });
    }

    // Get options
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const version = interaction.options.getString('version');
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const color = interaction.options.getString('color') || '#2f3136';

    // Create the initial embed
    const changelog = new EmbedBuilder()
      .setColor(color)
      .setTitle(`${title} - v${version}`)
      .setDescription(description)
      .addFields({ 
        name: 'Changes', 
        value: '*No changes added yet. Use the buttons below to add changes.*' 
      })
      .setFooter({ 
        text: `Version ${version} • ${new Date().toLocaleDateString()}`,
        iconURL: interaction.client.user.displayAvatarURL()
      })
      .setTimestamp();

    // Create buttons for interaction
    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('changelog_add_feature')
          .setLabel('Add Feature')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId('changelog_add_fix')
          .setLabel('Add Fix')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🛠️'),
        new ButtonBuilder()
          .setCustomId('changelog_add_improvement')
          .setLabel('Add Improvement')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⚡'),
        new ButtonBuilder()
          .setCustomId('changelog_post')
          .setLabel('Post Changelog')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('📢')
      );

    // Store the changelog data in a temporary "session"
    const changelogSession = {
      embedData: changelog.toJSON(),
      changes: {
        features: [],
        fixes: [],
        improvements: []
      },
      targetChannel: channel.id
    };

    // Store in client's temporary storage
    if (!interaction.client.changelogSessions) {
      interaction.client.changelogSessions = new Map();
    }
    
    interaction.client.changelogSessions.set(interaction.user.id, changelogSession);

    // Reply with the initial embed and buttons
    await interaction.reply({
      content: 'Building changelog. Use the buttons below to add entries:',
      embeds: [changelog],
      components: [buttons],
      ephemeral: true
    });
  },

  // Button handler functions
  buttons: {
    async changelog_add_feature(interaction) {
      await showAddEntryModal(interaction, 'Feature');
    },
    
    async changelog_add_fix(interaction) {
      await showAddEntryModal(interaction, 'Fix');
    },
    
    async changelog_add_improvement(interaction) {
      await showAddEntryModal(interaction, 'Improvement');
    },
    
    async changelog_post(interaction) {
      await postChangelog(interaction);
    }
  },

  // Modal submission handler
  async handleModalSubmit(interaction) {
    if (!interaction.customId.startsWith('changelog_add_')) return;

    const type = interaction.customId.replace('changelog_add_', '').toLowerCase();
    const entry = interaction.fields.getTextInputValue('changelog_entry');
    
    // Get the user's session
    const session = interaction.client.changelogSessions.get(interaction.user.id);
    if (!session) {
      return interaction.reply({
        content: 'Your changelog session has expired. Please create a new changelog.',
        ephemeral: true
      });
    }

    // Add the entry to the session
    if (type === 'feature') {
      session.changes.features.push(entry);
    } else if (type === 'fix') {
      session.changes.fixes.push(entry);
    } else if (type === 'improvement') {
      session.changes.improvements.push(entry);
    }

    // Update the embed
    updateChangelogEmbed(session);

    // Re-create the buttons
    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('changelog_add_feature')
          .setLabel('Add Feature')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId('changelog_add_fix')
          .setLabel('Add Fix')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🛠️'),
        new ButtonBuilder()
          .setCustomId('changelog_add_improvement')
          .setLabel('Add Improvement')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⚡'),
        new ButtonBuilder()
          .setCustomId('changelog_post')
          .setLabel('Post Changelog')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('📢')
      );

    // Update the message
    await interaction.update({
      content: 'Building changelog. Use the buttons below to add entries:',
      embeds: [EmbedBuilder.from(session.embedData)],
      components: [buttons],
    });
  }
};

// Helper function to show the modal for adding an entry
async function showAddEntryModal(interaction, type) {
  // Check if the session exists
  if (!interaction.client.changelogSessions?.has(interaction.user.id)) {
    return interaction.reply({
      content: 'Your changelog session has expired. Please create a new changelog.',
      ephemeral: true
    });
  }

  // Create modal
  const modal = new ModalBuilder()
    .setCustomId(`changelog_add_${type.toLowerCase()}`)
    .setTitle(`Add ${type} to Changelog`);

  // Add input field
  const entryInput = new TextInputBuilder()
    .setCustomId('changelog_entry')
    .setLabel(`${type} Description`)
    .setPlaceholder(`Enter the ${type.toLowerCase()} details...`)
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(3)
    .setMaxLength(1000)
    .setRequired(true);

  // Add the input to the modal
  const row = new ActionRowBuilder().addComponents(entryInput);
  modal.addComponents(row);

  // Show the modal
  await interaction.showModal(modal);
}

// Helper function to update the changelog embed based on the session data
function updateChangelogEmbed(session) {
  const embed = EmbedBuilder.from(session.embedData);
  
  // Prepare the fields
  const fields = [];
  
  // Add features if any
  if (session.changes.features.length > 0) {
    fields.push({
      name: '✅ New Features',
      value: session.changes.features.map(f => `• ${f}`).join('\n')
    });
  }
  
  // Add fixes if any
  if (session.changes.fixes.length > 0) {
    fields.push({
      name: '🛠️ Bug Fixes',
      value: session.changes.fixes.map(f => `• ${f}`).join('\n')
    });
  }
  
  // Add improvements if any
  if (session.changes.improvements.length > 0) {
    fields.push({
      name: '⚡ Improvements',
      value: session.changes.improvements.map(i => `• ${i}`).join('\n')
    });
  }
  
  // If no fields, add a default field
  if (fields.length === 0) {
    fields.push({
      name: 'Changes',
      value: '*No changes added yet. Use the buttons below to add changes.*'
    });
  }
  
  // Update the embed
  embed.setFields(fields);
  
  // Update the session's embed data
  session.embedData = embed.toJSON();
}

// Helper function to post the changelog
async function postChangelog(interaction) {
  // Get the session
  const session = interaction.client.changelogSessions.get(interaction.user.id);
  if (!session) {
    return interaction.reply({
      content: 'Your changelog session has expired. Please create a new changelog.',
      ephemeral: true
    });
  }
  
  try {
    // Get the target channel
    const channel = await interaction.client.channels.fetch(session.targetChannel);
    
    // Create the embed
    const embed = EmbedBuilder.from(session.embedData);
    
    // Send to the channel
    await channel.send({ embeds: [embed] });
    
    // Clean up the session
    interaction.client.changelogSessions.delete(interaction.user.id);
    
    // Notify the user
    await interaction.update({
      content: `Changelog has been posted to ${channel}.`,
      embeds: [embed],
      components: []
    });
  } catch (error) {
    console.error('Error posting changelog:', error);
    await interaction.reply({
      content: 'There was an error posting the changelog. Please try again.',
      ephemeral: true
    });
  }
} 