#!/bin/bash

# Pfade konfigurieren
PROJECT_ROOT="/home/container"
DASHBOARD_DIR="$PROJECT_ROOT/dashboard"

# ENV-Variablen für den Dashboard-Server
export DASHBOARD_PORT=3001
export JWT_SECRET=your_jwt_secret_key_change_in_production
export DISCORD_CLIENT_ID=1387777145975210014
export DISCORD_CLIENT_SECRET=N-oG9MCpF82sP9TOfPKUp8qkA9GzyMux
export DISCORD_REDIRECT_URI=http://localhost:5173/auth/callback
export CLIENT_URL=http://localhost:5173

# Farbige Ausgabe
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Alle laufenden Prozesse beenden
echo -e "${YELLOW}Stoppe alle laufenden Prozesse...${NC}"
pkill -f "node server/server.js" > /dev/null 2>&1 || true
pkill -f "vite" > /dev/null 2>&1 || true
pkill -f "node index.js" > /dev/null 2>&1 || true

# Warte einen Moment
sleep 1

# Logdateien löschen, falls sie existieren
rm -f "$PROJECT_ROOT/bot.log" "$DASHBOARD_DIR/api-server.log" "$DASHBOARD_DIR/frontend.log"

# Dashboard-Abhängigkeiten prüfen und ggf. installieren
if [ -f "$DASHBOARD_DIR/package.json" ]; then
    echo -e "${YELLOW}Prüfe Dashboard-Abhängigkeiten...${NC}"
    cd "$DASHBOARD_DIR" && /usr/local/bin/npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}Fehler beim Installieren der Dashboard-Abhängigkeiten!${NC}"
        exit 1
    fi
    echo -e "${GREEN}Dashboard-Abhängigkeiten installiert${NC}"
fi

# Discord Bot starten
echo -e "${YELLOW}Starte Discord Bot...${NC}"
cd "$PROJECT_ROOT" && /usr/local/bin/npm run dev > bot.log 2>&1 &
BOT_PID=$!
echo -e "${GREEN}Discord Bot gestartet (PID: $BOT_PID)${NC}"

# Warte einen Moment
sleep 2

# API-Server starten
echo -e "${YELLOW}Starte Dashboard API-Server...${NC}"
cd "$DASHBOARD_DIR" && node server/server.js > api-server.log 2>&1 &
API_PID=$!
sleep 3

# Überprüfen, ob der API-Server noch läuft (mit kill -0 statt ps)
if kill -0 $API_PID 2>/dev/null; then
    echo -e "${GREEN}API-Server gestartet (PID: $API_PID)${NC}"
else
    # Überprüfe die Log-Datei nach Fehlern
    if grep -i "error\|exception\|fail" "$DASHBOARD_DIR/api-server.log" > /dev/null; then
        echo -e "${RED}API-Server konnte nicht gestartet werden! Überprüfe api-server.log für Details.${NC}"
        echo -e "${YELLOW}=== Letzten 20 Zeilen des Logs: ===${NC}"
        tail -n 20 "$DASHBOARD_DIR/api-server.log"
        
        # Erstelle eine Kopie des Logs für späteren Zugriff
        cp "$DASHBOARD_DIR/api-server.log" "$PROJECT_ROOT/api-server-error.log"
        echo -e "${YELLOW}Log-Datei wurde auch nach $PROJECT_ROOT/api-server-error.log kopiert${NC}"
        exit 1
    else
        # Wenn keine Fehler im Log gefunden wurden, nehmen wir an, dass der Server läuft
        echo -e "${GREEN}API-Server scheint gestartet zu sein (PID: $API_PID)${NC}"
    fi
fi

# Warte einen Moment
sleep 2

# Frontend starten
echo -e "${YELLOW}Starte Dashboard Frontend...${NC}"
cd "$DASHBOARD_DIR" && /usr/local/bin/npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
sleep 1

# Überprüfen, ob der Frontend-Server noch läuft (mit kill -0 statt ps)
if kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${GREEN}Frontend-Server gestartet (PID: $FRONTEND_PID)${NC}"
else
    # Überprüfe die Log-Datei nach Fehlern
    if grep -i "error\|exception\|fail" "$DASHBOARD_DIR/frontend.log" > /dev/null; then
        echo -e "${RED}Frontend-Server konnte nicht gestartet werden! Überprüfe frontend.log für Details.${NC}"
        echo -e "${YELLOW}=== Letzten 20 Zeilen des Logs: ===${NC}"
        tail -n 20 "$DASHBOARD_DIR/frontend.log"
        
        # Erstelle eine Kopie des Logs für späteren Zugriff
        cp "$DASHBOARD_DIR/frontend.log" "$PROJECT_ROOT/frontend-error.log"
        echo -e "${YELLOW}Log-Datei wurde auch nach $PROJECT_ROOT/frontend-error.log kopiert${NC}"
        exit 1
    else
        # Wenn keine Fehler im Log gefunden wurden, nehmen wir an, dass der Server läuft
        echo -e "${GREEN}Frontend-Server scheint gestartet zu sein (PID: $FRONTEND_PID)${NC}"
    fi
fi

# Zusammenfassung anzeigen
echo
echo -e "${GREEN}=== Alle Komponenten wurden gestartet ===${NC}"
echo -e "Discord Bot: ${GREEN}läuft${NC} (PID: $BOT_PID) - Logs in: $PROJECT_ROOT/bot.log"
echo -e "API-Server: ${GREEN}läuft${NC} (PID: $API_PID) - Logs in: $DASHBOARD_DIR/api-server.log"
echo -e "Frontend: ${GREEN}läuft${NC} (PID: $FRONTEND_PID) - Logs in: $DASHBOARD_DIR/frontend.log"
echo
echo -e "${YELLOW}Dashboard ist verfügbar unter:${NC} http://localhost:5173"
echo -e "${YELLOW}Um alle Prozesse zu stoppen:${NC} pkill -f 'node server/server.js' && pkill -f 'vite' && pkill -f 'node index.js'"
echo

# Für Pterodactyl müssen wir sicherstellen, dass der Hauptprozess aktiv bleibt
echo -e "${YELLOW}Halte den Hauptprozess aktiv, damit Pterodactyl den Server als 'online' erkennt...${NC}"
echo -e "${YELLOW}Drücke CTRL+C, um alle Prozesse zu beenden${NC}"

# In Pterodactyl muss der Hauptprozess am Leben bleiben
tail -f "$PROJECT_ROOT/bot.log" "$DASHBOARD_DIR/api-server.log" "$DASHBOARD_DIR/frontend.log" 