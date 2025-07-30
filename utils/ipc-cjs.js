const fs = require('fs');
const path = require('path');

const IPC_FILE_PATH = path.join(__dirname, '../data/ipc-messages.json');

// Store registered message handlers
const messageHandlers = new Map();

/**
 * Send a message through the IPC mechanism
 * @param {string} type - Message type (e.g., 'changelog', 'loa')
 * @param {object} data - Message data
 * @returns {boolean} Success status
 */
function sendMessage(type, data) {
  try {
    // Initialize or read existing IPC messages
    let messages = [];
    if (fs.existsSync(IPC_FILE_PATH)) {
      try {
        messages = JSON.parse(fs.readFileSync(IPC_FILE_PATH, 'utf8'));
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
    fs.writeFileSync(IPC_FILE_PATH, JSON.stringify(messages, null, 2));
    console.log(`IPC message sent: ${type}`);
    return true;
  } catch (error) {
    console.error('Error sending IPC message:', error);
    return false;
  }
}

/**
 * Check for and process new messages
 * @param {Function} messageHandler - Function to handle messages (type, data) => Promise<boolean>
 * @returns {Promise<number>} Number of messages processed
 */
async function processMessages(messageHandler) {
  try {
    // Check if IPC file exists
    if (!fs.existsSync(IPC_FILE_PATH)) {
      return 0;
    }
    
    // Read messages
    const messages = JSON.parse(fs.readFileSync(IPC_FILE_PATH, 'utf8'));
    if (!messages || !messages.length) {
      return 0;
    }
    
    // Filter unprocessed messages
    const unprocessedMessages = messages.filter(msg => !msg.processed);
    if (!unprocessedMessages.length) {
      return 0;
    }
    
    // Process each message
    let processedCount = 0;
    for (const msg of unprocessedMessages) {
      try {
        const success = await messageHandler(msg.type, msg.data);
        if (success) {
          msg.processed = true;
          msg.processedAt = new Date().toISOString();
          processedCount++;
        }
      } catch (err) {
        console.error(`Error processing message ${msg.id}:`, err);
      }
    }
    
    // Write back updated messages
    fs.writeFileSync(IPC_FILE_PATH, JSON.stringify(messages, null, 2));
    
    return processedCount;
  } catch (error) {
    console.error('Error processing IPC messages:', error);
    return 0;
  }
}

/**
 * Register a handler for a specific message type
 * @param {string} type - Message type to handle
 * @param {Function} handler - Function to handle messages (data) => any
 * @returns {boolean} Success status
 */
function registerHandler(type, handler) {
  try {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }
    
    messageHandlers.set(type, handler);
    console.log(`Registered handler for IPC message type: ${type}`);
    return true;
  } catch (error) {
    console.error(`Error registering handler for ${type}:`, error);
    return false;
  }
}

/**
 * Check for messages with registered handlers and process them
 * @returns {Promise<number>} Number of messages processed
 */
async function processRegisteredMessages() {
  return processMessages(async (type, data) => {
    const handler = messageHandlers.get(type);
    if (handler) {
      try {
        await handler(data);
        return true;
      } catch (error) {
        console.error(`Error in handler for ${type}:`, error);
        return false;
      }
    }
    return false; // No handler registered for this type
  });
}

module.exports = {
  sendMessage,
  processMessages,
  registerHandler,
  processRegisteredMessages
};
