// Event handler for sending parrot GIFs when a specific user types "Parroto"
const { Events, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Use local GIF files from a directory
const gifsDir = path.join(__dirname, '..', 'gifs');

// Create the gifs directory if it doesn't exist
if (!fs.existsSync(gifsDir)) {
  fs.mkdirSync(gifsDir, { recursive: true });
}

// Pfad zur Datei, in der die erlaubten Benutzer gespeichert werden
const allowedUsersPath = path.join(__dirname, '..', 'data', 'parrotAllowedUsers.json');

// Funktion zum Laden der erlaubten Benutzer
function loadAllowedUsers() {
  try {
    // Erstelle das data-Verzeichnis, falls es nicht existiert
    const dataDir = path.dirname(allowedUsersPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    if (fs.existsSync(allowedUsersPath)) {
      const data = fs.readFileSync(allowedUsersPath, 'utf8');
      const users = JSON.parse(data);
      console.log(`Loaded ${users.length} allowed users for parrot feature`);
      return users;
    }
  } catch (error) {
    console.error(`Error loading allowed users: ${error.message}`);
  }
  
  return ['563877348173414454']; // Standard-Admin-ID als Fallback
}

module.exports = {
  name: Events.MessageCreate,
  once: false,
  async execute(message) {
    // Lade die aktuellen erlaubten Benutzer
    const allowedUserIds = loadAllowedUsers();
    
    // Überprüfe, ob der Benutzer das Feature nutzen darf
    if (!allowedUserIds.includes(message.author.id)) return;
    
    // Check if the message contains the trigger word (case insensitive)
    const content = message.content.toLowerCase();
    if (content.includes('parroto')) {
      try {
        // Lese alle Dateien im GIFs-Verzeichnis
        let gifFiles = [];
        
        try {
          gifFiles = fs.readdirSync(gifsDir)
            .filter(file => file.toLowerCase().endsWith('.gif'));
        } catch (readError) {
          console.error(`Error reading GIFs directory: ${readError.message}`);
        }
        
        // Wenn keine GIFs im Verzeichnis sind, verwende diese Backup-URLs
        if (gifFiles.length === 0) {
          console.log('No GIF files found in the directory, using fallback URLs');
          const directGifUrls = [
            'https://i.imgur.com/4M34hi2.gif',
            'https://i.imgur.com/xJS8len.gif',
            'https://i.imgur.com/FwRz3.gif'
          ];
          
          // Wähle eine zufällige URL aus
          const randomGifUrl = directGifUrls[Math.floor(Math.random() * directGifUrls.length)];
          await message.reply(randomGifUrl);
        } else {
          // Wähle eine zufällige GIF-Datei aus
          const randomGifFile = gifFiles[Math.floor(Math.random() * gifFiles.length)];
          const gifPath = path.join(gifsDir, randomGifFile);
          
          // Erstelle einen Discord-Anhang aus der Datei
          const attachment = new AttachmentBuilder(gifPath, { name: randomGifFile });
          
          // Sende die Datei als Antwort
          await message.reply({ files: [attachment] });
          console.log(`Sent local GIF file: ${randomGifFile}`);
        }
        
        console.log(`Sent parrot GIF to user ${message.author.tag}`);
      } catch (error) {
        console.error(`Error sending parrot GIF: ${error.message}`);
      }
    }
  },
};
