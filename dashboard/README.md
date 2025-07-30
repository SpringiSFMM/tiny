# Bot Dashboard

Ein modernes Web-Dashboard für den Discord Bot, erstellt mit React, Vite und Discord OAuth2.

## Features

- Discord Login-Integration
- Live-Statistiken des Bots
- Bot-Konfiguration über das Dashboard
- Changelog-Erstellung und -Verwaltung
- LOA-Verwaltung
- Benutzerrechte-Management

## Setup

### Voraussetzungen

- Node.js v18+
- npm oder yarn
- Discord Bot (bereits eingerichtet)
- Discord OAuth2 Anwendung

### Installation

1. Installiere die Abhängigkeiten:

```bash
cd dashboard
npm install
```

2. Erstelle eine `.env`-Datei im Root-Verzeichnis mit folgenden Einstellungen:

```
VITE_API_URL=http://localhost:3001/api
VITE_DISCORD_CLIENT_ID=dein_client_id
VITE_DISCORD_REDIRECT_URI=http://localhost:5173/auth/callback
```

3. Starte den Entwicklungsserver:

```bash
npm run dev
```

4. Starte den API-Server (separate Terminal-Sitzung):

```bash
npm run api
```

## Aufbau des Projekts

```
dashboard/
├── public/           # Statische Dateien
├── src/              # React-Code
│   ├── api/          # API-Integrationen
│   ├── components/   # UI-Komponenten
│   ├── context/      # React Context
│   ├── hooks/        # Custom Hooks
│   ├── layouts/      # Layout-Komponenten
│   ├── pages/        # Seiten-Komponenten
│   ├── stores/       # Zustandsverwaltung
│   ├── styles/       # CSS/SCSS-Dateien
│   ├── utils/        # Hilfsfunktionen
│   ├── App.jsx       # Hauptkomponente
│   └── main.jsx      # Einstiegspunkt
├── server/           # API-Server
│   ├── controllers/  # Route-Handler
│   ├── middleware/   # Express-Middleware
│   ├── models/       # Datenmodelle
│   ├── routes/       # API-Routen
│   └── server.js     # Express-Server
├── .env              # Umgebungsvariablen
├── index.html        # HTML-Template
├── package.json      # Projektabhängigkeiten
└── vite.config.js    # Vite-Konfiguration
```

## API-Endpunkte

Das Dashboard kommuniziert mit dem Bot über REST-API-Endpunkte:

- `GET /api/stats` - Allgemeine Bot-Statistiken
- `GET /api/config` - Bot-Konfiguration abrufen
- `POST /api/config` - Bot-Konfiguration aktualisieren
- `GET /api/loa` - LOA-Anfragen abrufen
- `POST /api/changelogs` - Changelog erstellen

## Discord OAuth2 Einrichtung

1. Besuche die [Discord Developer Portal](https://discord.com/developers/applications)
2. Wähle deine Anwendung aus
3. Gehe zu "OAuth2" > "General"
4. Füge unter "Redirects" den URI `http://localhost:5173/auth/callback` hinzu
5. Speichere die Änderungen
6. Kopiere die Client-ID und füge sie in die `.env`-Datei ein

## Technologie-Stack

- Frontend: React, Vite, Tailwind CSS, React Router, React Query
- State Management: Zustand
- API: Express.js, Socket.io (für Live-Updates)
- Authentifizierung: Discord OAuth2 