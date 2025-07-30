const fs = require('fs');
const path = require('path');

// Path to the active LOAs file
const LOA_FILE_PATH = path.join(__dirname, '../data/active-loas.json');

/**
 * Update LOA status in the JSON file
 * @param {string} loaId - The ID of the LOA to update
 * @param {Object} update - The update to apply { approved: boolean, denied: boolean, ... }
 * @returns {Object|null} - The updated LOA object or null if not found
 */
async function updateLoaStatus(loaId, update) {
  try {
    // Read the current LOAs
    const loasData = fs.readFileSync(LOA_FILE_PATH, 'utf8');
    let loas = JSON.parse(loasData);
    
    // Find the LOA to update
    const loaIndex = loas.findIndex(loa => loa.id === loaId);
    if (loaIndex === -1) {
      console.error(`LOA with ID ${loaId} not found for status update`);
      return null;
    }
    
    // Apply the update
    loas[loaIndex] = { ...loas[loaIndex], ...update, updatedAt: new Date().toISOString() };
    
    // Save the updated LOAs back to the file
    fs.writeFileSync(LOA_FILE_PATH, JSON.stringify(loas, null, 2));
    
    console.log(`LOA ${loaId} status updated: ${JSON.stringify(update)}`);
    return loas[loaIndex];
  } catch (error) {
    console.error(`Error updating LOA status: ${error.message}`);
    return null;
  }
}

/**
 * Get LOA by ID
 * @param {string} loaId - The ID of the LOA to find
 * @returns {Object|null} - The LOA object or null if not found
 */
async function getLoaById(loaId) {
  try {
    // Read the current LOAs
    const loasData = fs.readFileSync(LOA_FILE_PATH, 'utf8');
    const loas = JSON.parse(loasData);
    
    // Find the LOA
    return loas.find(loa => loa.id === loaId) || null;
  } catch (error) {
    console.error(`Error getting LOA by ID: ${error.message}`);
    return null;
  }
}

/**
 * Find Discord message ID for a specific LOA
 * @param {string} loaId - The ID of the LOA
 * @returns {string|null} - The message ID or null if not found
 */
async function getLoaMessageId(loaId) {
  try {
    // The path to the LOA message mapping file
    const mappingPath = path.join(__dirname, '../data/loa-message-map.json');
    
    // If file doesn't exist yet, return null
    if (!fs.existsSync(mappingPath)) {
      return null;
    }
    
    const mappingData = fs.readFileSync(mappingPath, 'utf8');
    const mapping = JSON.parse(mappingData);
    
    return mapping[loaId] || null;
  } catch (error) {
    console.error(`Error getting LOA message ID: ${error.message}`);
    return null;
  }
}

/**
 * Store mapping between LOA ID and Discord message ID
 * @param {string} loaId - The LOA ID
 * @param {string} messageId - The Discord message ID
 */
async function storeLoaMessageId(loaId, messageId) {
  try {
    // The path to the LOA message mapping file
    const mappingPath = path.join(__dirname, '../data/loa-message-map.json');
    
    // Initialize or read existing mapping
    let mapping = {};
    if (fs.existsSync(mappingPath)) {
      const mappingData = fs.readFileSync(mappingPath, 'utf8');
      mapping = JSON.parse(mappingData);
    }
    
    // Add the new mapping
    mapping[loaId] = messageId;
    
    // Save back to the file
    fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
    
    console.log(`Stored message ID ${messageId} for LOA ${loaId}`);
    return true;
  } catch (error) {
    console.error(`Error storing LOA message ID: ${error.message}`);
    return false;
  }
}

module.exports = {
  updateLoaStatus,
  getLoaById,
  getLoaMessageId,
  storeLoaMessageId
};
