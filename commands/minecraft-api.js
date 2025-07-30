// Direkter API-Zugriff auf Minecraft-Spielerstatistiken
const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const axios = require('axios');
const moment = require('moment-timezone');
const fs = require('fs');
const path = require('path');

// Environment variables for API URLs
const MOJANG_API_URL = process.env.MOJANG_API_URL || 'https://api.mojang.com';


/**
 * Lädt die Server-Konfigurationen aus der JSON-Datei
 * @returns {Object} Server-Konfigurationen
 */
function loadServerConfigs() {
  try {
    const configPath = path.join(__dirname, '../data/minecraft-servers.json');
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    }
    // Fallback auf Standardkonfiguration, falls Datei nicht existiert
    return { 
      default: { 
        name: "Default Server", 
        apiUrl: process.env.MINECRAFT_API_URL || "https://api.example.com",
        apiPassword: process.env.MINECRAFT_API_PASSWORD || ""
      } 
    };
  } catch (error) {
    console.error('Error loading server configurations:', error);
    return { 
      default: { 
        name: "Default Server", 
        apiUrl: process.env.MINECRAFT_API_URL || "https://api.example.com",
        apiPassword: process.env.MINECRAFT_API_PASSWORD || ""
      } 
    };
  }
}

/**
 * Formatiert die Spielzeit in Stunden und Minuten
 * @param {number} minutes - Spielzeit in Minuten
 * @returns {string} Formatierte Spielzeit
 */
function formatPlaytime(minutes) {
  if (minutes === undefined || minutes === null) return 'Keine Daten';
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours > 0) {
    return `${hours} Stunden, ${mins} Minuten`;
  } else {
    return `${mins} Minuten`;
  }
}

/**
 * Formatiert ein Datum in deutsches Format
 * @param {string} dateStr - Datum als String
 * @returns {string} Formatiertes Datum
 */
function formatDate(dateStr) {
  if (!dateStr) return 'Keine Daten';
  
  const date = moment(dateStr);
  if (!date.isValid()) return 'Ungültiges Datum';
  
  return date.format('DD.MM.YYYY HH:mm');
}

/**
 * Formatiert eine Zahl mit Tausendertrennzeichen
 * @param {number} num - Zu formatierende Zahl
 * @returns {string} Formatierte Zahl
 */
function formatNumber(num) {
  if (num === undefined || num === null) return 'Keine Daten';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('minecraft-api')
    .setDescription('Ruft direkt Statistiken über die API ab')
    .addStringOption(option => 
      option.setName('username')
        .setDescription('Minecraft Benutzername')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('server')
        .setDescription('Der Minecraft Server, von dem Daten abgerufen werden sollen')
        .setRequired(false)
        .setAutocomplete(true)),
  
  // Autocomplete-Handler für Server-Option
  async autocomplete(interaction) {
    // Server-Konfigurationen laden
    const serverConfigs = loadServerConfigs();
    
    const focusedValue = interaction.options.getFocused();
    const choices = Object.keys(serverConfigs).map(id => ({
      name: `${serverConfigs[id].name} (${id})`,
      value: id
    }));
    
    const filtered = choices.filter(choice => 
      choice.name.toLowerCase().includes(focusedValue.toLowerCase()));
    
    await interaction.respond(
      filtered.slice(0, 25)
    );
  },
  
  async execute(interaction) {
    // Antwort verzögern, um Zeit für die Verarbeitung zu haben
    await interaction.deferReply({ ephemeral: true });
    
    try {
      // Server-Konfigurationen laden
      const serverConfigs = loadServerConfigs();
      
      // Optionen vom Befehl holen
      const username = interaction.options.getString('username');
      const serverId = interaction.options.getString('server') || 'default';
      
      // Prüfen, ob der Server in den Konfigurationen existiert
      if (serverId !== 'default' && !serverConfigs[serverId]) {
        return interaction.editReply({
          content: `❌ Der Server "${serverId}" existiert nicht in unserer Konfiguration.`,
          ephemeral: true
        });
      }
      
      // Zuerst Benutzernamen über die Mojang API verifizieren
      try {
        const profileResponse = await axios.get(`${MOJANG_API_URL}/users/profiles/minecraft/${encodeURIComponent(username)}`, {
          timeout: 5000
        });
        
        if (!profileResponse.data || !profileResponse.data.id) {
          return interaction.editReply({
            content: `❌ Der Minecraft Spieler **${username}** existiert nicht.`,
            ephemeral: true
          });
        }
        
        const uuid = profileResponse.data.id;
        const correctUsername = profileResponse.data.name;
        
        // API-Details für diesen Server holen
        const apiUrl = serverConfigs[serverId] ? serverConfigs[serverId].apiUrl : serverConfigs.default.apiUrl;
        const apiPassword = serverConfigs[serverId] ? serverConfigs[serverId].apiPassword : serverConfigs.default.apiPassword;
        const serverName = serverConfigs[serverId] ? serverConfigs[serverId].name : 'Default';
        
        try {
          console.log(`Versuche API-Aufruf zu ${apiUrl}/?username=${encodeURIComponent(correctUsername)}`);
          
          // Erweiterte Axios-Konfiguration für robustere Verbindungen und JSON-Behandlung
          const axiosConfig = {
            timeout: 15000, // 15 Sekunden Timeout für langsamere API-Server
            headers: {
              'Authorization': `Bearer ${apiPassword}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            // Explizit als JSON parsen
            responseType: 'json',
            // Verbindungsoptionen für stabilere HTTP-Verbindungen
            maxRedirects: 5,
            validateStatus: function (status) {
              return status >= 200 && status < 500; // Nur wirkliche Server-Fehler als Fehler behandeln
            },
            // HTTPS-Agent mit angepassten Einstellungen für ältere Server
            httpsAgent: new (require('https').Agent)({
              rejectUnauthorized: false, // Akzeptiere selbstsignierte Zertifikate
              keepAlive: true,
              keepAliveMsecs: 3000
            }),
            // Keine Proxys verwenden
            proxy: false,
            // Transformieren der Antwort explizit als JSON
            transformResponse: [(data) => {
              // Falls die Antwort bereits ein String ist, versuche es als JSON zu parsen
              if (typeof data === 'string') {
                try {
                  return JSON.parse(data);
                } catch (e) {
                  console.error('Fehler beim Parsen der JSON-Antwort:', e);
                  return { error: 'Ungültige JSON-Antwort vom Server' };
                }
              }
              return data;
            }]
          };
          
          let statsResponse;
          try {
            // Versuche den API-Aufruf mit erweitertem Timeout und verbesserten Verbindungsoptionen
            statsResponse = await axios.get(`${apiUrl}/?username=${encodeURIComponent(correctUsername)}`, axiosConfig);
            
            // Prüfen auf leere oder ungültige Antworten
            if (!statsResponse.data || Object.keys(statsResponse.data).length === 0) {
              console.error('Leere oder ungültige Antwort vom API-Server erhalten');
              return interaction.editReply({
                content: `❌ Der API-Server für **${serverName}** hat eine leere Antwort gesendet. Bitte kontaktiere den Server-Administrator und teile mit, dass der API-Endpoint keine Daten zurückliefert.`,
                ephemeral: true
              });
            }
            
            console.log(`API-Antwort erhalten. Status: ${statsResponse.status}, Datentyp: ${typeof statsResponse.data}`);
          } catch (apiError) {
            console.error('API-Anfrage fehlgeschlagen:', apiError.message);
            
            // Detailliertere Fehleranalyse für bessere Benutzerfeedbacks
            if (apiError.code === 'ECONNREFUSED') {
              return interaction.editReply({
                content: `❌ Verbindung zum API-Server für **${serverName}** konnte nicht hergestellt werden. Der Server ist möglicherweise offline.\n\nServer-URL: \`${apiUrl}\``,
                ephemeral: true
              });
            } else if (apiError.code === 'ECONNRESET' || apiError.message === 'socket hang up') {
              return interaction.editReply({
                content: `❌ Die Verbindung zum API-Server wurde zurückgesetzt ("socket hang up"). Der Server hat möglicherweise folgende Probleme:\n\n1. Der Server sendet keine Antwort\n2. Firewall blockiert die Verbindung\n3. Die API ist nicht korrekt konfiguriert\n\nBitte wende dich an den Server-Administrator. Falls du Administrator bist, überprüfe die API-Logs.\n\nServer-URL: \`${apiUrl}\``,
                ephemeral: true
              });
            } else if (apiError.message && (apiError.message.includes('empty response') || apiError.message.includes('Empty reply'))) {
              return interaction.editReply({
                content: `❌ Der API-Server liefert eine leere Antwort. Die API scheint erreichbar zu sein, sendet jedoch keine Daten. Bitte überprüfe:\n\n1. Ist der API-Endpunkt korrekt? (\`${apiUrl}\`)\n2. Ist die API-Authentifizierung korrekt konfiguriert?\n3. Ist die API aktiviert und funktionsfähig?\n\nBitte wende dich an den Server-Administrator für weitere Unterstützung.`,
                ephemeral: true
              });
            } else if (apiError.code === 'ETIMEDOUT') {
              return interaction.editReply({
                content: `❌ Zeitlimit der API-Anfrage überschritten. Der API-Server antwortet zu langsam oder ist nicht erreichbar.\n\nServer-URL: \`${apiUrl}\``,
                ephemeral: true
              });
            } else if (apiError.response) {
              // Der Server hat mit einem Fehlercode geantwortet
              return interaction.editReply({
                content: `❌ API-Fehler: ${apiError.response.status} - ${apiError.response.statusText || 'Unbekannter Fehler'}\n\nServer-URL: \`${apiUrl}\``,
                ephemeral: true
              });
            } else {
              return interaction.editReply({
                content: `❌ Fehler bei der Kommunikation mit dem API-Server: ${apiError.message}\n\nServer-URL: \`${apiUrl}\``,
                ephemeral: true
              });
            }
          }
          
          if (!statsResponse || !statsResponse.data) {
            return interaction.editReply({
              content: `❌ Keine Statistiken für **${correctUsername}** auf dem Server **${serverName}** gefunden.`,
              ephemeral: true
            });
          }
          
          // Daten für die weitere Verarbeitung verwenden
          const playerStats = statsResponse.data;
          
          // Kontoinformationen aus der API oder Schätzung
          let accountCreationDate;
          if (playerStats.creationDate) {
            accountCreationDate = moment(playerStats.creationDate);
          } else {
            accountCreationDate = moment('2015-01-01'); // Fallback-Datum
          }
          
          // Alter des Kontos berechnen
          const now = moment();
          const ageInDays = now.diff(accountCreationDate, 'days');
          
          // Alter in Jahre und Tage formatieren
          const years = Math.floor(ageInDays / 365);
          const remainingDays = ageInDays % 365;
          let accountAgeText;
          
          if (years > 0) {
            accountAgeText = `${years} Jahre, ${remainingDays} Tage`;
          } else {
            accountAgeText = `${ageInDays} Tage`;
          }
          
          // Datum formatieren
          const formattedCreationDate = accountCreationDate.format('DD.MM.YYYY');
          
          // Embed erstellen
          const embed = new EmbedBuilder()
            .setColor('#4CAF50')
            .setTitle(`${correctUsername}'s Minecraft Statistiken`)
            .setDescription(`Statistiken von Server: **${serverName}**`)
            .addFields(
              { name: 'Account erstellt am', value: formattedCreationDate, inline: true },
              { name: 'Account Alter', value: accountAgeText, inline: true }
            );
          
          // UUID hinzufügen
          embed.addFields({ name: 'UUID', value: uuid, inline: false });
          
          // Spielerstatistiken hinzufügen, falls vorhanden
          if (playerStats) {
            // Add fields based on available stats
            if (playerStats.playtime !== undefined) {
              embed.addFields({ name: 'Spielzeit', value: formatPlaytime(playerStats.playtime) || 'Keine Daten', inline: true });
            }
            
            if (playerStats.lastSeen !== undefined) {
              const lastSeen = playerStats.lastSeen ? formatDate(playerStats.lastSeen) : 'Nie';
              embed.addFields({ name: 'Zuletzt gesehen', value: lastSeen, inline: true });
            }
            
            if (playerStats.kills !== undefined) {
              embed.addFields({ name: 'Kills', value: formatNumber(playerStats.kills), inline: true });
            }
            
            if (playerStats.deaths !== undefined) {
              embed.addFields({ name: 'Tode', value: formatNumber(playerStats.deaths), inline: true });
            }
            
            if (playerStats.level !== undefined) {
              embed.addFields({ name: 'Level', value: formatNumber(playerStats.level), inline: true });
            }
            
            if (playerStats.balance !== undefined) {
              embed.addFields({ name: 'Kontostand', value: formatNumber(playerStats.balance), inline: true });
            }
            
            if (playerStats.blocksBroken !== undefined) {
              embed.addFields({ name: 'Blöcke abgebaut', value: formatNumber(playerStats.blocksBroken), inline: true });
            }
            
            if (playerStats.blocksPlaced !== undefined) {
              embed.addFields({ name: 'Blöcke platziert', value: formatNumber(playerStats.blocksPlaced), inline: true });
            }
            
            // Benutzerdefinierte Felder hinzufügen, falls vorhanden
            if (playerStats.customStats && typeof playerStats.customStats === 'object') {
              for (const [key, value] of Object.entries(playerStats.customStats)) {
                if (value !== undefined) {
                  // Versuchen, den Schlüssel benutzerfreundlicher zu formatieren
                  const formattedKey = key
                    .replace(/([A-Z])/g, ' $1') // camelCase zu Wörtern
                    .replace(/^./, str => str.toUpperCase()) // Ersten Buchstaben großschreiben
                    .replace(/_/g, ' '); // Unterstriche durch Leerzeichen ersetzen
                  
                  // Wert formatieren, wenn es eine Zahl ist
                  const formattedValue = typeof value === 'number' 
                    ? formatNumber(value)
                    : value.toString();
                  
                  embed.addFields({ name: formattedKey, value: formattedValue, inline: true });
                }
              }
            }
          }
          
          // Antwort senden
          return interaction.editReply({
            embeds: [embed],
            ephemeral: true
          });
          
        } catch (error) {
          console.error('Error fetching player stats from custom API:', error);
          
          // Detaillierte Fehleranalyse für bessere Benutzerfeedbacks
          let errorMessage = `❌ Fehler beim Abrufen der Statistiken für **${correctUsername}**`;
          
          if (error.code === 'ECONNREFUSED') {
            errorMessage += ` - Der API-Server (${apiUrl}) ist nicht erreichbar. Bitte überprüfe die Server-Konfiguration.`;
          } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
            errorMessage += ` - Die Verbindung zum API-Server wurde unterbrochen oder hat das Timeout überschritten. Der Server könnte überlastet sein.`;
          } else if (error.response) {
            // Der Server hat geantwortet, aber mit einem Fehlercode
            errorMessage += ` - Die API hat einen Fehler zurückgegeben (${error.response.status}): ${error.response.statusText || 'Unbekannter Fehler'}.`;
          } else {
            // Allgemeiner Fehler
            errorMessage += ` - ${error.message || 'Unbekannter Fehler beim API-Aufruf'}.`;
          }
          
          console.log(`Detaillierte Fehlerinformationen für API-Aufruf: ${errorMessage}`);
          
          return interaction.editReply({
            content: `${errorMessage}\n\nBitte versuche es später erneut oder wende dich an den Server-Administrator.`,
            ephemeral: true
          });
        }
        
      } catch (error) {
        console.error('Error retrieving Minecraft profile data:', error);
        return interaction.editReply({
          content: `❌ Fehler beim Überprüfen des Minecraft-Benutzernamens. Bitte versuche es später erneut.`,
          ephemeral: true
        });
      }
      
    } catch (error) {
      console.error('Error in minecraft-api command:', error);
      return interaction.editReply({
        content: `❌ Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es später erneut.`,
        ephemeral: true
      });
    }
  }
};
