const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('staff-role')
    .setDescription('Configure roles for the Staff LOA system')
    .addSubcommand(subcommand =>
      subcommand
        .setName('staff')
        .setDescription('Set the staff role required for staff-loa and staff-return commands')
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('The staff role')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('loa')
        .setDescription('Set the role assigned during Leave of Absence')
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('The LOA role')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('channel')
        .setDescription('Set the channel for LOA announcements')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('The channel where LOA requests will be posted')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('show')
        .setDescription('Show the current role settings'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction) {
    // Only server administrators can use this command
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '❌ You need administrator permissions to use this command.',
        ephemeral: true
      });
    }

    // Path to the configuration file
    const configPath = path.join(__dirname, '..', 'data', 'staff-config.json');
    
    // Ensure the directory exists
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Load existing configuration or create a new one
    let staffConfig = { staffRoleId: '', loaRoleId: '', loaChannelId: '1307038560226119731' };
    try {
      if (fs.existsSync(configPath)) {
        staffConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
    } catch (error) {
      console.error('Error loading configuration:', error);
    }
    
    // Determine which subcommand was executed
    const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === 'staff') {
      // Set the staff role
      const role = interaction.options.getRole('role');
      staffConfig.staffRoleId = role.id;
      
      // Konfiguration speichern
      try {
        fs.writeFileSync(configPath, JSON.stringify(staffConfig, null, 2), 'utf8');
        
        // Create confirmation embed
        const embed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Staff Role Updated')
          .setDescription(`The staff role has been set to **${role.name}**.`)
          .addFields(
            { name: 'Role', value: `<@&${role.id}>`, inline: true },
            { name: 'Role ID', value: role.id, inline: true }
          )
          .setTimestamp();
        
        return interaction.reply({ embeds: [embed] });
      } catch (error) {
        console.error('Error saving configuration:', error);
        return interaction.reply({
          content: `❌ Error saving configuration: ${error.message}`,
          ephemeral: true
        });
      }
    } else if (subcommand === 'loa') {
      // Set the LOA role
      const role = interaction.options.getRole('role');
      staffConfig.loaRoleId = role.id;
      
      // Konfiguration speichern
      try {
        fs.writeFileSync(configPath, JSON.stringify(staffConfig, null, 2), 'utf8');
        
        // Create confirmation embed
        const embed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ LOA Role Updated')
          .setDescription(`The LOA role has been set to **${role.name}**.`)
          .addFields(
            { name: 'Role', value: `<@&${role.id}>`, inline: true },
            { name: 'Role ID', value: role.id, inline: true }
          )
          .setTimestamp();
        
        return interaction.reply({ embeds: [embed] });
      } catch (error) {
        console.error('Error saving configuration:', error);
        return interaction.reply({
          content: `❌ Error saving configuration: ${error.message}`,
          ephemeral: true
        });
      }
    } else if (subcommand === 'channel') {
      // Set the LOA channel
      const channel = interaction.options.getChannel('channel');
      
      // Check if it's a text channel
      if (channel.type !== 0) { // 0 = GUILD_TEXT
        return interaction.reply({
          content: '❌ Please select a text channel for LOA announcements.',
          ephemeral: true
        });
      }
      
      staffConfig.loaChannelId = channel.id;
      
      // Konfiguration speichern
      try {
        fs.writeFileSync(configPath, JSON.stringify(staffConfig, null, 2), 'utf8');
        
        // Create confirmation embed
        const embed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ LOA Channel Updated')
          .setDescription(`The LOA channel has been set to **${channel.name}**.`)
          .addFields(
            { name: 'Channel', value: `<#${channel.id}>`, inline: true },
            { name: 'Channel ID', value: channel.id, inline: true }
          )
          .setTimestamp();
        
        return interaction.reply({ embeds: [embed] });
      } catch (error) {
        console.error('Error saving configuration:', error);
        return interaction.reply({
          content: `❌ Error saving configuration: ${error.message}`,
          ephemeral: true
        });
      }
    } else if (subcommand === 'show') {
      // Show current settings
      let staffRoleText = 'Not configured';
      let loaRoleText = 'Not configured';
      let loaChannelText = 'Not configured';
      
      if (staffConfig.staffRoleId) {
        try {
          const staffRole = await interaction.guild.roles.fetch(staffConfig.staffRoleId);
          if (staffRole) {
            staffRoleText = `${staffRole.name} (<@&${staffRole.id}>)`;
          } else {
            staffRoleText = `Invalid role (ID: ${staffConfig.staffRoleId})`;
          }
        } catch (error) {
          console.error('Error fetching staff role:', error);
          staffRoleText = `Error fetching role (ID: ${staffConfig.staffRoleId})`;
        }
      }
      
      if (staffConfig.loaRoleId) {
        try {
          const loaRole = await interaction.guild.roles.fetch(staffConfig.loaRoleId);
          if (loaRole) {
            loaRoleText = `${loaRole.name} (<@&${loaRole.id}>)`;
          } else {
            loaRoleText = `Invalid role (ID: ${staffConfig.loaRoleId})`;
          }
        } catch (error) {
          console.error('Error fetching LOA role:', error);
          loaRoleText = `Error fetching role (ID: ${staffConfig.loaRoleId})`;
        }
      }
      
      if (staffConfig.loaChannelId) {
        try {
          const loaChannel = await interaction.guild.channels.fetch(staffConfig.loaChannelId);
          if (loaChannel) {
            loaChannelText = `${loaChannel.name} (<#${loaChannel.id}>)`;
          } else {
            loaChannelText = `Invalid channel (ID: ${staffConfig.loaChannelId})`;
          }
        } catch (error) {
          console.error('Error fetching LOA channel:', error);
          loaChannelText = `Error fetching channel (ID: ${staffConfig.loaChannelId})`;
        }
      }
      
      // Create settings embed
      const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('🔧 Staff System Settings')
        .addFields(
          { name: 'Staff Role', value: staffRoleText, inline: false },
          { name: 'LOA Role', value: loaRoleText, inline: false },
          { name: 'LOA Channel', value: loaChannelText, inline: false }
        )
        .setDescription('These settings are used for the `/staff-loa` and `/staff-return` commands.')
        .setFooter({ text: 'Use /staff-role staff, /staff-role loa or /staff-role channel to change these settings.' })
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed] });
    }
  }
};
