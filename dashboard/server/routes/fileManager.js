import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Pfad für Dateiuploads
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

// Erstellen Sie das Upload-Verzeichnis, falls es nicht existiert
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Datenbank für die freigegebenen Links
const LINKS_DB_PATH = path.join(process.cwd(), 'data', 'shared-links.json');

// Stellen Sie sicher, dass die Datei für Links existiert
if (!fs.existsSync(path.dirname(LINKS_DB_PATH))) {
  fs.mkdirSync(path.dirname(LINKS_DB_PATH), { recursive: true });
}
if (!fs.existsSync(LINKS_DB_PATH)) {
  fs.writeFileSync(LINKS_DB_PATH, JSON.stringify([]), 'utf8');
}

// Multer-Konfiguration für Datei-Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Bestimmen Sie das Zielverzeichnis basierend auf dem Anfragepfad
    const uploadPath = req.body.currentPath ? 
      path.join(UPLOADS_DIR, req.body.currentPath) : 
      UPLOADS_DIR;
    
    // Erstellen Sie das Verzeichnis, falls es nicht existiert
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generieren Sie einen eindeutigen Dateinamen
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB Limit
});

// Hilfsfunktion zum Lesen der Links-Datenbank
const getLinksDb = () => {
  try {
    const data = fs.readFileSync(LINKS_DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Fehler beim Lesen der Links-Datenbank:', error);
    return [];
  }
};

// Hilfsfunktion zum Schreiben der Links-Datenbank
const saveLinksDb = (links) => {
  try {
    fs.writeFileSync(LINKS_DB_PATH, JSON.stringify(links, null, 2), 'utf8');
  } catch (error) {
    console.error('Fehler beim Speichern der Links-Datenbank:', error);
  }
};

// Öffentliche Endpunkte zum Abrufen von Dateien
// Diese Routen müssen VOR der Authentifizierung stehen, damit sie öffentlich zugänglich sind

// GET-Methode zum direkten Anzeigen von Dateien in geteilten Links
router.get('/public/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { password, view } = req.query;
    
    const links = getLinksDb();
    const link = links.find(l => l.id === id && l.active);
    
    if (!link) {
      return res.status(404).json({ error: 'Link ungültig oder deaktiviert' });
    }
    
    // Überprüfen Sie das Ablaufdatum
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      return res.status(403).json({ error: 'Dieser Link ist abgelaufen' });
    }
    
    // Überprüfen Sie das Passwort, falls vorhanden
    if (link.passwordHash && password) {
      const isPasswordValid = bcrypt.compareSync(password, link.passwordHash);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Ungültiges Passwort' });
      }
    } else if (link.passwordHash && !password) {
      // Wenn die Datei passwortgeschützt ist, aber kein Passwort angegeben wurde
      // Leiten Sie zur HTML-Seite weiter, wo nach dem Passwort gefragt wird
      if (view === 'true') {
        return res.redirect(`/file/${id}`);
      } else {
        return res.status(401).json({ error: 'Passwort erforderlich', requiresPassword: true });
      }
    }
    
    const filePath = path.join(UPLOADS_DIR, link.filePath);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Datei nicht gefunden' });
    }
    
    const fileName = path.basename(filePath);
    const fileExtension = path.extname(fileName).toLowerCase();
    
    // Wenn view=true, versuchen Sie, die Datei direkt anzuzeigen (Bild/Video)
    if (view === 'true') {
      // Für Bilder
      const validImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'];
      if (validImageExtensions.includes(fileExtension)) {
        // MIME-Typ ermitteln für Bilder
        let contentType = 'image/jpeg';
        switch (fileExtension) {
          case '.png': contentType = 'image/png'; break;
          case '.gif': contentType = 'image/gif'; break;
          case '.svg': contentType = 'image/svg+xml'; break;
          case '.webp': contentType = 'image/webp'; break;
        }
        
        // Bild zurückgeben
        res.setHeader('Content-Type', contentType);
        return fs.createReadStream(filePath).pipe(res);
      }
      
      // Für Videos
      const validVideoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];
      if (validVideoExtensions.includes(fileExtension)) {
        // MIME-Typ ermitteln für Videos
        let contentType = 'video/mp4';
        switch (fileExtension) {
          case '.webm': contentType = 'video/webm'; break;
          case '.ogg': contentType = 'video/ogg'; break;
          case '.mov': contentType = 'video/quicktime'; break;
          case '.avi': contentType = 'video/x-msvideo'; break;
        }
        
        // Video zurückgeben
        res.setHeader('Content-Type', contentType);
        return fs.createReadStream(filePath).pipe(res);
      }
      
      // Für andere Dateitypen oder wenn die Anzeige nicht möglich ist, auf HTML-Seite umleiten
      return res.redirect(`/file/${id}`);
    }
    
    // Standard: Datei zum Download anbieten
    res.download(filePath, fileName);
  } catch (error) {
    console.error('Fehler beim Abrufen der freigegebenen Datei:', error);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der freigegebenen Datei' });
  }
});

// Datei-Download für öffentlich geteilte Links
router.post('/public/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { password, view } = req.body;
    
    const links = getLinksDb();
    const link = links.find(l => l.id === id && l.active);
    
    if (!link) {
      return res.status(404).json({ error: 'Link ungültig oder deaktiviert' });
    }
    
    // Überprüfen Sie das Ablaufdatum
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      return res.status(403).json({ error: 'Dieser Link ist abgelaufen' });
    }
    
    // Überprüfen Sie das Passwort, falls vorhanden
    if (link.passwordHash) {
      if (!password) {
        return res.status(401).json({ error: 'Passwort erforderlich', requiresPassword: true });
      }
      
      const isPasswordValid = bcrypt.compareSync(password, link.passwordHash);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Ungültiges Passwort' });
      }
    }
    
    const filePath = path.join(UPLOADS_DIR, link.filePath);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Datei nicht gefunden' });
    }
    
    const fileName = path.basename(filePath);
    const fileExtension = path.extname(fileName).toLowerCase();
    
    // Bestimmen Sie den Dateityp und entscheiden Sie, ob die Datei direkt angezeigt werden kann
    if (view === 'true') {
      // Für Bilder
      const validImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'];
      if (validImageExtensions.includes(fileExtension)) {
        // MIME-Typ ermitteln für Bilder
        let contentType = 'image/jpeg';
        switch (fileExtension) {
          case '.png': contentType = 'image/png'; break;
          case '.gif': contentType = 'image/gif'; break;
          case '.svg': contentType = 'image/svg+xml'; break;
          case '.webp': contentType = 'image/webp'; break;
        }
        
        // Bild zurückgeben
        res.setHeader('Content-Type', contentType);
        return fs.createReadStream(filePath).pipe(res);
      }
      
      // Für Videos
      const validVideoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];
      if (validVideoExtensions.includes(fileExtension)) {
        // MIME-Typ ermitteln für Videos
        let contentType = 'video/mp4';
        switch (fileExtension) {
          case '.webm': contentType = 'video/webm'; break;
          case '.ogg': contentType = 'video/ogg'; break;
          case '.mov': contentType = 'video/quicktime'; break;
          case '.avi': contentType = 'video/x-msvideo'; break;
        }
        
        // Video zurückgeben
        res.setHeader('Content-Type', contentType);
        return fs.createReadStream(filePath).pipe(res);
      }
    }
    
    // Standard: Datei zum Download anbieten
    res.download(filePath, fileName);
  } catch (error) {
    console.error('Fehler beim Abrufen der freigegebenen Datei:', error);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der freigegebenen Datei' });
  }
});

// Datei-Download-Endpunkt für authentifizierte Benutzer (wird aber vor dem JWT-Check platziert)
router.get('/download', async (req, res) => {
  try {
    const { path: filePath } = req.query;
    
    if (!filePath) {
      return res.status(400).json({ error: 'Dateipfad ist erforderlich' });
    }
    
    const fullPath = path.join(UPLOADS_DIR, filePath);
    
    // Überprüfen, ob der Pfad gültig ist und innerhalb des Upload-Verzeichnisses liegt
    if (!fullPath.startsWith(UPLOADS_DIR)) {
      return res.status(400).json({ error: 'Ungültiger Pfad' });
    }
    
    // Überprüfen, ob die Datei existiert
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Datei nicht gefunden' });
    }
    
    // Datei herunterladen
    const fileName = path.basename(fullPath);
    res.download(fullPath, fileName);
  } catch (error) {
    console.error('Fehler beim Herunterladen der Datei:', error);
    res.status(500).json({ error: 'Serverfehler beim Herunterladen der Datei' });
  }
});

// Bild-Anzeige-Endpunkt für authentifizierte Benutzer (wird aber vor dem JWT-Check platziert)
router.get('/image', async (req, res) => {
  try {
    const { path: filePath } = req.query;
    
    if (!filePath) {
      return res.status(400).json({ error: 'Dateipfad ist erforderlich' });
    }
    
    const fullPath = path.join(UPLOADS_DIR, filePath);
    
    // Überprüfen, ob der Pfad gültig ist und innerhalb des Upload-Verzeichnisses liegt
    if (!fullPath.startsWith(UPLOADS_DIR)) {
      return res.status(400).json({ error: 'Ungültiger Pfad' });
    }
    
    // Überprüfen, ob die Datei existiert
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Datei nicht gefunden' });
    }
    
    // Überprüfen des Dateityps
    const fileExtension = path.extname(fullPath).toLowerCase();
    const validImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'];
    
    if (!validImageExtensions.includes(fileExtension)) {
      return res.status(400).json({ error: 'Ungültiger Bildtyp' });
    }
    
    // MIME-Typ ermitteln
    let contentType = 'image/jpeg';
    switch (fileExtension) {
      case '.png': contentType = 'image/png'; break;
      case '.gif': contentType = 'image/gif'; break;
      case '.svg': contentType = 'image/svg+xml'; break;
      case '.webp': contentType = 'image/webp'; break;
    }
    
    // Bild zurückgeben
    res.setHeader('Content-Type', contentType);
    fs.createReadStream(fullPath).pipe(res);
  } catch (error) {
    console.error('Fehler beim Anzeigen des Bildes:', error);
    res.status(500).json({ error: 'Serverfehler beim Anzeigen des Bildes' });
  }
});

// Middleware für die Autorisierung - alles nach dieser Zeile erfordert einen gültigen JWT Token
router.use(verifyToken);

// Endpunkt zum Abrufen der Verzeichnisstruktur
router.get('/files', async (req, res) => {
  try {
    const directoryPath = req.query.path ? path.join(UPLOADS_DIR, req.query.path) : UPLOADS_DIR;
    
    // Überprüfen, ob der Pfad gültig ist und innerhalb des Upload-Verzeichnisses liegt
    if (!directoryPath.startsWith(UPLOADS_DIR)) {
      return res.status(400).json({ error: 'Ungültiger Pfad' });
    }
    
    // Überprüfen, ob das Verzeichnis existiert
    if (!fs.existsSync(directoryPath)) {
      return res.status(404).json({ error: 'Verzeichnis nicht gefunden' });
    }
    
    const items = fs.readdirSync(directoryPath);
    const fileList = [];
    
    for (const item of items) {
      const itemPath = path.join(directoryPath, item);
      const stats = fs.statSync(itemPath);
      const relativePath = path.relative(UPLOADS_DIR, itemPath);
      
      fileList.push({
        name: item,
        path: relativePath,
        isDirectory: stats.isDirectory(),
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime
      });
    }
    
    res.json(fileList);
  } catch (error) {
    console.error('Fehler beim Abrufen der Dateien:', error);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Dateien' });
  }
});

// Endpunkt zum Erstellen eines neuen Verzeichnisses
router.post('/directory', async (req, res) => {
  try {
    const { path: dirPath, name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Verzeichnisname ist erforderlich' });
    }
    
    const newDirPath = dirPath ? 
      path.join(UPLOADS_DIR, dirPath, name) : 
      path.join(UPLOADS_DIR, name);
    
    // Überprüfen, ob der Pfad gültig ist und innerhalb des Upload-Verzeichnisses liegt
    if (!newDirPath.startsWith(UPLOADS_DIR)) {
      return res.status(400).json({ error: 'Ungültiger Pfad' });
    }
    
    // Überprüfen, ob das Verzeichnis bereits existiert
    if (fs.existsSync(newDirPath)) {
      return res.status(400).json({ error: 'Verzeichnis existiert bereits' });
    }
    
    // Erstellen des Verzeichnisses
    fs.mkdirSync(newDirPath, { recursive: true });
    
    res.status(201).json({
      name,
      path: path.relative(UPLOADS_DIR, newDirPath),
      isDirectory: true,
      createdAt: new Date()
    });
  } catch (error) {
    console.error('Fehler beim Erstellen des Verzeichnisses:', error);
    res.status(500).json({ error: 'Serverfehler beim Erstellen des Verzeichnisses' });
  }
});

// Endpunkt zum Hochladen von Dateien
router.post('/upload', upload.array('files'), async (req, res) => {
  try {
    const files = req.files;
    const currentPath = req.body.currentPath || '';
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'Keine Dateien hochgeladen' });
    }
    
    const uploadedFiles = files.map(file => {
      const relativePath = path.relative(UPLOADS_DIR, file.path);
      
      return {
        name: path.basename(file.originalname),
        filename: path.basename(file.path),
        path: relativePath,
        size: file.size,
        mimetype: file.mimetype,
        uploadedAt: new Date()
      };
    });
    
    res.status(201).json(uploadedFiles);
  } catch (error) {
    console.error('Fehler beim Hochladen der Dateien:', error);
    res.status(500).json({ error: 'Serverfehler beim Hochladen der Dateien' });
  }
});

// Endpunkt zum Teilen einer Datei
router.post('/share', async (req, res) => {
  try {
    const { filePath, password, expiresAt } = req.body;
    const userId = req.user.id; // Aus dem Token
    
    if (!filePath) {
      return res.status(400).json({ error: 'Dateipfad ist erforderlich' });
    }
    
    const fullPath = path.join(UPLOADS_DIR, filePath);
    
    // Überprüfen, ob der Pfad gültig ist und innerhalb des Upload-Verzeichnisses liegt
    if (!fullPath.startsWith(UPLOADS_DIR)) {
      return res.status(400).json({ error: 'Ungültiger Pfad' });
    }
    
    // Überprüfen, ob die Datei existiert
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Datei nicht gefunden' });
    }
    
    // Erstellen eines neuen Freigabelinks
    const linkId = uuidv4();
    const links = getLinksDb();
    
    const link = {
      id: linkId,
      filePath,
      createdBy: userId,
      createdAt: new Date(),
      active: true
    };
    
    // Wenn ein Passwort angegeben wurde, hashen Sie es
    if (password) {
      const salt = bcrypt.genSaltSync(10);
      link.passwordHash = bcrypt.hashSync(password, salt);
    }
    
    // Wenn ein Ablaufdatum angegeben wurde, fügen Sie es hinzu
    if (expiresAt) {
      link.expiresAt = new Date(expiresAt);
    }
    
    links.push(link);
    saveLinksDb(links);
    
    res.status(201).json({
      id: linkId,
      url: `/file/${linkId}`,
      hasPassword: !!password,
      expiresAt: expiresAt ? new Date(expiresAt) : null
    });
  } catch (error) {
    console.error('Fehler beim Teilen der Datei:', error);
    res.status(500).json({ error: 'Serverfehler beim Teilen der Datei' });
  }
});

// Endpunkt zum Deaktivieren eines Freigabelinks
router.delete('/share/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id; // Aus dem Token
    
    const links = getLinksDb();
    const linkIndex = links.findIndex(link => link.id === id);
    
    if (linkIndex === -1) {
      return res.status(404).json({ error: 'Link nicht gefunden' });
    }
    
    // Überprüfen, ob der Benutzer der Eigentümer des Links ist
    if (links[linkIndex].createdBy !== userId) {
      return res.status(403).json({ error: 'Sie haben keine Berechtigung, diesen Link zu deaktivieren' });
    }
    
    // Deaktivieren des Links
    links[linkIndex].active = false;
    saveLinksDb(links);
    
    res.json({ success: true, message: 'Link deaktiviert' });
  } catch (error) {
    console.error('Fehler beim Deaktivieren des Links:', error);
    res.status(500).json({ error: 'Serverfehler beim Deaktivieren des Links' });
  }
});

// Endpunkt zum Löschen einer Datei
router.delete('/files', async (req, res) => {
  try {
    const { path: filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: 'Dateipfad ist erforderlich' });
    }
    
    const fullPath = path.join(UPLOADS_DIR, filePath);
    
    // Überprüfen, ob der Pfad gültig ist und innerhalb des Upload-Verzeichnisses liegt
    if (!fullPath.startsWith(UPLOADS_DIR)) {
      return res.status(400).json({ error: 'Ungültiger Pfad' });
    }
    
    // Überprüfen, ob die Datei existiert
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Datei oder Verzeichnis nicht gefunden' });
    }
    
    const stats = fs.statSync(fullPath);
    
    if (stats.isDirectory()) {
      // Rekursives Löschen eines Verzeichnisses
      fs.rmdirSync(fullPath, { recursive: true });
    } else {
      // Löschen einer Datei
      fs.unlinkSync(fullPath);
      
      // Deaktivieren aller Links, die auf diese Datei verweisen
      const links = getLinksDb();
      const updatedLinks = links.map(link => {
        if (link.filePath === filePath) {
          return { ...link, active: false };
        }
        return link;
      });
      
      saveLinksDb(updatedLinks);
    }
    
    res.json({ success: true, message: `${stats.isDirectory() ? 'Verzeichnis' : 'Datei'} gelöscht` });
  } catch (error) {
    console.error('Fehler beim Löschen:', error);
    res.status(500).json({ error: 'Serverfehler beim Löschen' });
  }
});

// Endpunkt zum Abrufen aller aktiven Links eines Benutzers
router.get('/links', async (req, res) => {
  try {
    const userId = req.user.id; // Aus dem Token
    
    const allLinks = getLinksDb();
    const userLinks = allLinks
      .filter(link => link.createdBy === userId)
      .map(link => ({
        id: link.id,
        filePath: link.filePath,
        fileName: path.basename(link.filePath),
        url: `/file/${link.id}`,
        active: link.active,
        hasPassword: !!link.passwordHash,
        expiresAt: link.expiresAt,
        createdAt: link.createdAt
      }));
    
    res.json(userLinks);
  } catch (error) {
    console.error('Fehler beim Abrufen der Links:', error);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Links' });
  }
});

export default router;
