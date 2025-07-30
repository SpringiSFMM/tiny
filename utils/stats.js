// Stats collection and reporting for Discord Bot Dashboard
const fs = require('fs');
const path = require('path');

// IPC funktioniert in CommonJS anders, wir implementieren eine direkte Version
function sendIpcMessage(type, data) {
  try {
    const ipcFilePath = path.join(__dirname, '../data/ipc-messages.json');
    
    // Initialize or read existing IPC messages
    let messages = [];
    if (fs.existsSync(ipcFilePath)) {
      try {
        messages = JSON.parse(fs.readFileSync(ipcFilePath, 'utf8'));
      } catch (err) {
        console.error('Error reading IPC file, starting with empty array:', err);
        messages = [];
      }
    }
    
    // Add new message
    messages.push({
      id: Date.now().toString(),
      type,
      data,
      timestamp: new Date().toISOString(),
      processed: false
    });
    
    // Write back to file
    fs.writeFileSync(ipcFilePath, JSON.stringify(messages, null, 2));
    console.log(`Bot stats IPC message sent: ${type}`);
    return true;
  } catch (error) {
    console.error('Error sending IPC message from bot stats:', error);
    return false;
  }
}

/**
 * Collects current stats from the Discord client
 * @param {Client} client - Discord.js client instance
 * @returns {Object} Stats object with current bot statistics
 */
function collectStats(client) {
  // Basic validation
  if (!client || !client.guilds) {
    console.error('Invalid client provided to collectStats');
    return null;
  }

  try {
    // Get server count
    const serverCount = client.guilds.cache.size;
    
    // Get total user count across all guilds (may count duplicates if users are in multiple servers)
    let userCount = 0;
    client.guilds.cache.forEach(guild => {
      if (guild.memberCount) {
        userCount += guild.memberCount;
      }
    });
    
    // Get command usage count if available, otherwise set to 0
    const commandCount = client.commandCount || 0;
    
    // Calculate uptime
    const uptimeMs = client.uptime;
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    const uptime = `${days}d ${hours % 24}h ${minutes % 60}m`;
    
    // Get latency (websocket ping)
    const latency = `${Math.round(client.ws.ping)}ms`;
    
    return {
      servers: serverCount,
      users: userCount,
      commands: commandCount,
      uptime,
      latency
      // Note: activeLoas is handled by the server directly from the JSON file
    };
  } catch (error) {
    console.error('Error collecting bot stats:', error);
    return null;
  }
}

/**
 * Start periodic stats reporting to the dashboard
 * @param {Client} client - Discord.js client instance
 * @param {number} interval - Reporting interval in milliseconds (default: 30000 - 30 seconds)
 * @returns {NodeJS.Timeout} Interval ID for stopping if needed
 */
function startStatsReporting(client, interval = 30000) {
  console.log(`Starting stats reporting with ${interval}ms interval`);
  
  // Track command usage
  if (!client.commandCount) {
    client.commandCount = 0;
  }
  
  // Initial stats report
  reportStats(client);
  
  // Set up periodic reporting
  return setInterval(() => {
    reportStats(client);
  }, interval);
}

/**
 * Report current stats to the dashboard via IPC
 * @param {Client} client - Discord.js client instance
 */
function reportStats(client) {
  const stats = collectStats(client);
  
  if (stats) {
    console.log('Reporting bot stats to dashboard:', stats);
    sendIpcMessage('bot_stats_update', stats);
  }
}

/**
 * Increment the command usage counter
 * @param {Client} client - Discord.js client instance 
 */
function incrementCommandCount(client) {
  if (client && typeof client.commandCount !== 'undefined') {
    client.commandCount++;
  }
}

module.exports = {
  collectStats,
  startStatsReporting,
  reportStats,
  incrementCommandCount
};
