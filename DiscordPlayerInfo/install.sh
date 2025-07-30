#!/bin/bash
# DiscordPlayerInfo Plugin Installationsskript
# Erstellt von SpringiSFM

# Farbdefinitionen
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Willkommensnachricht
echo -e "${BLUE}=======================================${NC}"
echo -e "${BLUE}  DiscordPlayerInfo Plugin Installer   ${NC}"
echo -e "${BLUE}=======================================${NC}\n"

# Prüfen, ob der Minecraft-Server-Ordner existiert
read -p "Bitte geben Sie den Pfad zu Ihrem Minecraft-Server-Ordner ein: " SERVER_PATH

if [ ! -d "$SERVER_PATH" ]; then
    echo -e "${RED}Fehler: Der angegebene Pfad existiert nicht oder ist kein Ordner.${NC}"
    exit 1
fi

# Prüfen, ob der plugins-Ordner existiert
PLUGINS_PATH="$SERVER_PATH/plugins"
if [ ! -d "$PLUGINS_PATH" ]; then
    echo -e "${YELLOW}Der plugins-Ordner wurde nicht gefunden. Erstelle ihn...${NC}"
    mkdir -p "$PLUGINS_PATH"
    if [ $? -ne 0 ]; then
        echo -e "${RED}Fehler: Konnte den plugins-Ordner nicht erstellen.${NC}"
        exit 1
    fi
fi

# Plugin-JAR-Datei kopieren
PLUGIN_JAR="target/discord-player-info-1.0.0.jar"
if [ ! -f "$PLUGIN_JAR" ]; then
    echo -e "${RED}Fehler: Die Plugin-JAR-Datei wurde nicht gefunden.${NC}"
    echo -e "${YELLOW}Bitte führen Sie 'mvn clean package' aus, um das Plugin zu kompilieren.${NC}"
    exit 1
fi

echo -e "\n${YELLOW}Kopiere Plugin-Datei in den plugins-Ordner...${NC}"
cp "$PLUGIN_JAR" "$PLUGINS_PATH/"
if [ $? -ne 0 ]; then
    echo -e "${RED}Fehler: Konnte die Plugin-JAR-Datei nicht kopieren.${NC}"
    exit 1
fi

# Prüfen, ob LuckPerms installiert ist
if [ ! -f "$PLUGINS_PATH/LuckPerms"*.jar ]; then
    echo -e "\n${YELLOW}Warnung: LuckPerms wurde nicht im plugins-Ordner gefunden.${NC}"
    echo -e "${YELLOW}DiscordPlayerInfo benötigt LuckPerms für die Rangverwaltung.${NC}"
    read -p "Möchten Sie LuckPerms jetzt herunterladen? (j/n): " DOWNLOAD_LUCKPERMS
    
    if [[ $DOWNLOAD_LUCKPERMS == "j" || $DOWNLOAD_LUCKPERMS == "J" ]]; then
        echo -e "\n${YELLOW}Lade LuckPerms herunter...${NC}"
        curl -o "$PLUGINS_PATH/LuckPerms-Bukkit-5.4.102.jar" "https://download.luckperms.net/1526/bukkit/loader/LuckPerms-Bukkit-5.4.102.jar"
        if [ $? -ne 0 ]; then
            echo -e "${RED}Fehler: Konnte LuckPerms nicht herunterladen.${NC}"
            echo -e "${YELLOW}Bitte laden Sie LuckPerms manuell von https://luckperms.net/download herunter.${NC}"
        else
            echo -e "${GREEN}LuckPerms wurde erfolgreich heruntergeladen.${NC}"
        fi
    fi
fi

# API-Konfiguration
echo -e "\n${YELLOW}Konfiguriere die API für die Discord-Bot-Integration...${NC}"
API_KEY=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
API_PORT=8080

echo -e "Generierter API-Schlüssel: ${GREEN}$API_KEY${NC}"
echo -e "Standard-API-Port: ${GREEN}$API_PORT${NC}\n"

# Informationen für den Discord-Bot
echo -e "${YELLOW}Fügen Sie die folgenden Zeilen zu Ihrer .env-Datei des Discord-Bots hinzu:${NC}"
echo -e "${BLUE}MINECRAFT_SERVER_URL=http://localhost:$API_PORT${NC}"
echo -e "${BLUE}MINECRAFT_API_KEY=$API_KEY${NC}\n"

echo -e "${YELLOW}Hinweis: Wenn Ihr Discord-Bot auf einem anderen Computer läuft,${NC}"
echo -e "${YELLOW}ersetzen Sie 'localhost' durch die IP-Adresse dieses Servers.${NC}\n"

# Erstelle Konfigurationsdatei
PLUGIN_CONFIG_DIR="$PLUGINS_PATH/DiscordPlayerInfo"
mkdir -p "$PLUGIN_CONFIG_DIR"

echo -e "\n${YELLOW}Erstelle vorkonfigurierte config.yml...${NC}"
cat > "$PLUGIN_CONFIG_DIR/config.yml" << EOF
## DiscordPlayerInfo Configuration

# API Configuration
api:
  # Enable the REST API for the Discord bot to connect to
  enabled: true
  
  # Port for the REST API server
  port: $API_PORT
  
  # API key for authentication (leave empty to disable authentication)
  # Important: This key must match MINECRAFT_API_KEY in your Discord bot's .env file
  api-key: "$API_KEY"
  
  # Allow CORS (Cross-Origin Resource Sharing)
  allow-cors: true
  
  # Allowed origins for CORS (use * for all origins)
  allowed-origins: "*"
  
# Player Data Settings
player-data:
  # Cache duration in seconds (how long to cache player data)
  cache-duration: 300
  
  # Include AFK status from Essentials (if available)
  include-afk: true
  
  # Include player statistics
  include-stats: true
  
  # Default timezone if not specified by the player
  default-timezone: "Europe/Berlin"
  
# Debug Settings
debug:
  enabled: false
  log-api-requests: false
EOF

echo -e "${GREEN}Installation abgeschlossen!${NC}"
echo -e "\n${BLUE}=======================================${NC}"
echo -e "${BLUE}      Nächste Schritte:                ${NC}"
echo -e "${BLUE}=======================================${NC}"
echo -e "1. Starten Sie Ihren Minecraft-Server neu"
echo -e "2. Aktualisieren Sie die .env-Datei Ihres Discord-Bots"
echo -e "3. Starten Sie Ihren Discord-Bot neu"
echo -e "4. Testen Sie den Befehl /minecraft-user in Discord\n"
echo -e "${GREEN}Bei Fragen oder Problemen konsultieren Sie INSTALLATION_MINECRAFT.md${NC}"
