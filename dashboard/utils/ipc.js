import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// IPC file path is in the project root's data directory
const IPC_FILE_PATH = path.join(__dirname, '../../data/ipc-messages.json');

// Handlers for different message types
const handlers = {};

/**
 * Send a message through the IPC mechanism
 * @param {string} type - Message type (e.g., 'changelog', 'loa')
 * @param {object} data - Message data
 * @returns {boolean} Success status
 */
export function sendMessage(type, data) {
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
    console.log(`IPC message sent: ${type}`, data);
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
/**
 * Register a handler for a specific message type
 * @param {string} type - Message type to handle
 * @param {Function} handler - Function to handle the message
 */
export function registerHandler(type, handler) {
  handlers[type] = handler;
  console.log(`Registered handler for message type: ${type}`);
}

export async function processMessages(messageHandler) {
  try {
    // Check if IPC file exists
    if (!fs.existsSync(IPC_FILE_PATH)) {
      return 0;
    }
    
    // Read messages
    let messages = JSON.parse(fs.readFileSync(IPC_FILE_PATH, 'utf8'));
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
        // First try registered handlers
        if (handlers[msg.type]) {
          const result = await handlers[msg.type](msg.data);
          if (result && result.success) {
            msg.processed = true;
            msg.processedAt = new Date().toISOString();
            processedCount++;
            continue;
          }
        }
        
        // Fall back to provided message handler
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
