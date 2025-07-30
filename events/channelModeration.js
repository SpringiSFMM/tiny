// Event handler for automatic moderation of the "serious" channel
const { Events, EmbedBuilder } = require('discord.js');
const { HfInference } = require('@huggingface/inference');

// Feature toggle - Controlled via environment variable (default: disabled)
const MODERATION_ENABLED = process.env.ENABLE_CHANNEL_MODERATION === 'true';
console.log(`Channel moderation is ${MODERATION_ENABLED ? 'ENABLED' : 'DISABLED'}`);

// Behavior settings
const DELETE_MESSAGES = false; // Set to false to keep off-topic messages (only warn)

// Channel IDs
const SERIOUS_CHANNEL_ID = '1307038561412972576'; // Serious channel for team questions
const OFFTOPIC_CHANNEL_ID = '1387337930800107684'; // Off-topic channel for everything else

// Hugging Face configuration
let hf = null;
try {
  if (process.env.HUGGING_FACE_TOKEN && MODERATION_ENABLED) {
    hf = new HfInference(process.env.HUGGING_FACE_TOKEN);
    console.log('Hugging Face Inference API initialized');
  } else if (MODERATION_ENABLED) {
    console.log('No Hugging Face token found, falling back to keyword-based moderation');
  }
} catch (error) {
  console.error('Error initializing Hugging Face:', error.message);
}

// Keywords for detecting off-topic messages
const OFFTOPIC_KEYWORDS = [
  'funny', 'lol', 'haha', 'xd', 'lmao', 'rofl', 'meme', 'joke', 'fun',
  'vacation', 'weather', 'game', 'gaming', 'party', 'movie', 'series', 'music',
  'food', 'drink', 'hello', 'hi', 'hey', 'what\'s up', 'yo', 'sup'
];

// Keywords for detecting on-topic messages in the serious channel
const ONTOPIC_KEYWORDS = [
  'server', 'problem', 'question', 'help', 'support', 'team', 'admin', 'moderator',
  'rule', 'suggestion', 'bug', 'error', 'issue', 'discord', 'bot', 'role',
  'permission', 'channel', 'category', 'staff', 'authorize', 'assistance'
];

/**
 * Checks the message content using the Hugging Face Inference API
 * @param {string} messageContent - The content of the message
 * @returns {Promise<boolean>} - True if the message is on-topic, False if it's off-topic
 */
async function checkMessageWithAI(messageContent) {
  if (!hf) {
    return null; // AI not available, fall back to keyword-based check
  }
  
  try {
    // For text classification, we use a sentiment analysis model
    // "Off-topic" is treated as negative sentiment, "On-topic" as positive
    const result = await hf.textClassification({
      model: "cardiffnlp/twitter-roberta-base-sentiment",
      inputs: `Team channel message: "${messageContent}"`,
    });

    // The model returns three labels: LABEL_0 (NEGATIVE), LABEL_1 (NEUTRAL), LABEL_2 (POSITIVE)
    const sentiment = result[0].label;
    console.log(`AI classification for message: "${messageContent.substring(0, 30)}..." - Result: ${sentiment} (Score: ${result[0].score.toFixed(4)})`);
    
    // LABEL_0 = NEGATIVE = Off-Topic, LABEL_1/LABEL_2 = NEUTRAL/POSITIVE = On-Topic
    const isOffTopic = sentiment === "LABEL_0";
    
    // For short greetings, better decide based on keywords
    if (messageContent.length < 10 && /^(hi|hey|hello|sup|yo|wassup|greetings)/i.test(messageContent)) {
      console.log("Short greeting detected, marked as off-topic");
      return false; // Off-Topic
    }
    
    return !isOffTopic;
  } catch (error) {
    console.error('Error in Hugging Face request:', error.message);
    return null;
  }
}

/**
 * Checks the message content based on keywords
 * @param {string} content - The content of the message
 * @returns {boolean} - True if the message is on-topic, False if it's off-topic
 */
function isMessageOnTopic(content) {
  const lowerContent = content.toLowerCase();
  
  // Check for on-topic keywords
  for (const keyword of ONTOPIC_KEYWORDS) {
    if (lowerContent.includes(keyword)) {
      return true;
    }
  }
  
  // Check for off-topic keywords
  for (const keyword of OFFTOPIC_KEYWORDS) {
    if (lowerContent.includes(keyword)) {
      return false;
    }
  }
  
  // If nothing can be clearly assigned, check length
  // Longer messages tend to be more on-topic (detailed questions)
  return content.length > 100;
}

module.exports = {
  name: Events.MessageCreate,
  once: false,
  async execute(message) {
    // Feature toggle check - return early if disabled
    if (!MODERATION_ENABLED) {
      return;
    }
    
    // Only check messages in the serious channel
    if (message.channelId !== SERIOUS_CHANNEL_ID) return;
    
    // Ignore bots and webhook messages
    if (message.author.bot || message.webhookId) return;
    
    // Team members with specific roles can post anything (optional)
    if (message.member && message.member.roles && message.member.roles.cache && 
        message.member.roles.cache.some(role => 
          ['Admin', 'Administrator', 'Moderator', 'Staff'].includes(role.name))) {
      return;
    }
    
    // Check the message content
    let isOnTopic = null;
    
    // First try to check with AI if available
    if (hf) {
      isOnTopic = await checkMessageWithAI(message.content);
    }
    
    // If AI doesn't provide an answer, fall back to keyword analysis
    if (isOnTopic === null) {
      isOnTopic = isMessageOnTopic(message.content);
    }
    
    // Off-topic message found, handle according to settings
    if (isOnTopic === false) {
      try {
        console.log(`Off-topic message from ${message.author.tag} detected: "${message.content.substring(0, 30)}..."`);
        
        // Create appropriate embed based on if we're deleting or just warning
        const embed = new EmbedBuilder()
          .setColor(0xFFA500) // Orange instead of red since we're not deleting
          .setTitle(DELETE_MESSAGES ? '⚠️ Off-Topic Message Removed' : '⚠️ Off-Topic Message Detected')
          .setDescription(
            DELETE_MESSAGES
              ? `${message.author}, your message doesn't belong in this channel. Please use <#${OFFTOPIC_CHANNEL_ID}> for off-topic conversations.`
              : `${message.author}, your message seems to be off-topic for this channel. For casual conversations, please use <#${OFFTOPIC_CHANNEL_ID}> in the future.`
          )
          .addFields(
            { name: 'Team Questions Channel', value: 'This channel is reserved for serious questions and discussions related to the server and team.' }
          )
          .setFooter({ text: 'This message will be automatically deleted in 15 seconds.' })
          .setTimestamp();
        
        // Delete message if configured to do so
        if (DELETE_MESSAGES) {
          await message.delete().catch(error => {
            console.error('Error deleting message:', error.message);
          });
        }
        
        // Send notice and delete after 15 seconds
        const warningMsg = await message.channel.send({ 
          content: `${message.author}`,
          embeds: [embed] 
        }).catch(error => {
          console.error('Error sending warning message:', error.message);
          return null;
        });
        
        if (warningMsg) {
          setTimeout(() => {
            warningMsg.delete().catch(error => 
              console.error('Error deleting warning message:', error.message)
            );
          }, 15000);
        }
        
        // Log appropriate message
        if (DELETE_MESSAGES) {
          console.log(`Off-topic message from ${message.author.tag} removed from serious channel`);
        } else {
          console.log(`Off-topic message from ${message.author.tag} warned but kept in serious channel`);
        }
      } catch (error) {
        console.error('Error moderating off-topic message:', error);
      }
    }
  },
}; 