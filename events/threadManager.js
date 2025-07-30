// Thread manager for automatically archiving LOA threads when status changes
const { Events } = require('discord.js');

module.exports = {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction) {
    // Only handle button interactions
    if (!interaction.isButton()) return;
    
    // Check if this is a LOA-related button
    const customId = interaction.customId;
    if (!customId.startsWith('approve_loa_') && !customId.startsWith('deny_loa_')) return;
    
    // Check if we're in a thread
    if (!interaction.channel.isThread()) return;
    
    try {
      // Wait a bit to allow the LOA approval/denial process to complete
      setTimeout(async () => {
        try {
          console.log(`Archiving thread for LOA interaction: ${customId}`);
          await interaction.channel.setArchived(true, 'LOA request processed');
          console.log(`Thread archived successfully: ${interaction.channel.name}`);
        } catch (error) {
          console.error(`Failed to archive thread: ${error.message}`);
        }
      }, 3000); // 3 seconds delay
    } catch (error) {
      console.error(`Error in thread archiving: ${error.message}`);
    }
  },
};
