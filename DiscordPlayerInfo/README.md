# DiscordPlayerInfo

Ein Spigot/Paper-Plugin, das Spielerinformationen für die Integration mit einem Discord-Bot über eine REST-API bereitstellt.

## Features

- **REST-API** für den Zugriff auf Spielerinformationen
- **LuckPerms-Integration** zur Anzeige von Spielerrängen
- **Essentials-Integration** (optional) für AFK-Status und weitere Informationen
- **Caching-System** für verbesserte Performance
- **Zeitzonenverwaltung** für Spieler
- **Detaillierte Spielerstatistiken**

## Installation

1. Lade das Plugin herunter und lege es in deinen `plugins`-Ordner.
2. Starte den Server neu oder lade das Plugin mit einem Plugin-Manager.
3. Konfiguriere die `config.yml` nach deinen Bedürfnissen.
4. Stelle sicher, dass LuckPerms installiert ist (Pflicht).
5. Installiere Essentials für zusätzliche Funktionen (optional).

## API-Endpunkte

Das Plugin stellt folgende API-Endpunkte bereit:

### `GET /api/players`

Gibt eine Liste aller Online-Spieler zurück.

Beispielantwort:
```json
{
  "online": 5,
  "max": 100,
  "players": {
    "550e8400-e29b-41d4-a716-446655440000": "Spieler1",
    "550e8400-e29b-41d4-a716-446655440001": "Spieler2"
  }
}
```

### `GET /api/players/{username}`

Gibt detaillierte Informationen über einen bestimmten Spieler zurück.

Beispielantwort:
```json
{
  "username": "Spieler1",
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "isOnline": true,
  "lastSeen": 1626875400000,
  "rank": "Admin",
  "playtime": 12450,
  "displayName": "§c[Admin] Spieler1",
  "timezone": "Europe/Berlin",
  "afk": false,
  "location": {
    "world": "world",
    "x": 100,
    "y": 64,
    "z": -250
  },
  "avatarUrl": "https://mc-heads.net/avatar/Spieler1"
}
```

## Discord-Bot Integration

Um dieses Plugin mit dem Discord-Bot zu verbinden:

1. Stelle sicher, dass das Plugin läuft und die API aktiviert ist.
2. Konfiguriere deinen Discord-Bot mit der Plugin-API-URL:
   ```
   MINECRAFT_SERVER_URL=http://deine-server-ip:8080
   MINECRAFT_API_KEY=dein-api-key-aus-config.yml
   ```
3. Verwende den `/minecraft-user` Befehl im Discord, um Spielerinformationen abzurufen.

## Konfiguration

Die wichtigsten Konfigurationsoptionen in `config.yml`:

```yaml
api:
  enabled: true  # API aktivieren/deaktivieren
  port: 8080     # API-Port
  api-key: "dein-sicherer-schlüssel"  # Sicherheitsschlüssel für API-Zugriff

player-data:
  cache-duration: 300  # Cache-Dauer in Sekunden
  default-timezone: "Europe/Berlin"  # Standard-Zeitzone
```

## Befehle

- `/discordinfo reload` - Lädt die Konfiguration neu
- `/discordinfo stats` - Zeigt API-Statistiken an

## Berechtigungen

- `discordplayerinfo.admin` - Erlaubt die Verwendung aller Plugin-Befehle

## Kompilieren

Das Plugin verwendet Maven als Build-System:

```bash
cd DiscordPlayerInfo
mvn clean package
```

Die kompilierte JAR-Datei findest du im `target`-Ordner.

## Anforderungen

- Java 17 oder höher
- Paper/Spigot Server 1.20+
- LuckPerms 5.4+
- Essentials (optional, für erweiterte Funktionen)
