import express from 'express';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import DiscordOauth2 from 'discord-oauth2';
import dotenv from 'dotenv';
import axios from 'axios';
import querystring from 'querystring';

// Import routes
import fileManagerRoutes from './routes/fileManager.js';

// Import auth and role middleware
import { requirePermission, requireChangelogAccess, requireBotConfigAccess } from './middleware/roleBasedAuth.js';

// Setup file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Path to project root directory (for data files)
const projectRoot = path.join(__dirname, '../../');

// Import IPC module for Discord integration
import * as ipcModule from '../utils/ipc.js';
import { processMessages } from '../utils/ipc.js';
const sendMessage = ipcModule.sendMessage;

// Constants and configuration
const PORT = process.env.DASHBOARD_PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production';
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1387777145975210014';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || 'N-oG9MCpF82sP9TOfPKUp8qkA9GzyMux';
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'http://localhost:5173/auth/callback';
const DEVELOPER_ID = '563877348173414454';

// Initialize Discord OAuth2
const oauth = new DiscordOauth2({
  clientId: DISCORD_CLIENT_ID,
  clientSecret: DISCORD_CLIENT_SECRET,
  redirectUri: DISCORD_REDIRECT_URI,
});

// Initialize Express
const app = express();
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// File Manager Routes
app.use('/api/files', fileManagerRoutes);

// Erstellen des Uploads-Verzeichnisses, falls es nicht existiert
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Public endpoint for shared files download
app.get('/file/:id', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/file.html'));
});

// Static file serving for uploads in development
if (process.env.NODE_ENV !== 'production') {
  // Zusätzliche Entwicklungsmodus-Konfiguration wenn nötig
}

// Create HTTP server and Socket.io instance
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
  }
});

// Middleware to verify JWT
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header is missing' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Bearer token is missing' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    req.user = user;
    // Double-check isAdmin flag
    req.user.isAdmin = user.id === DEVELOPER_ID;
    console.log(`JWT Auth - User ID: ${user.id}, isAdmin: ${req.user.isAdmin}`);
    next();
  });
};

// Admin check middleware
const isAdmin = (req, res, next) => {
  console.log('isAdmin middleware - User:', req.user);
  
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Check if user is the developer by ID
  if (req.user.id !== DEVELOPER_ID) {
    console.log(`Admin check failed: User ID ${req.user.id} does not match Developer ID ${DEVELOPER_ID}`);
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  console.log(`Admin access granted for user ${req.user.username} (${req.user.id})`);
  next();
};

// ==================== ROUTES ====================

// Auth routes
app.post('/api/auth/token', async (req, res) => {
  try {
    const { code } = req.body;
    
    console.log('AUTH REQUEST RECEIVED:', { code: code ? `${code.substring(0, 10)}...` : 'missing' });
    console.log('ENV CONFIG:', { 
      clientId: DISCORD_CLIENT_ID,
      redirectUri: DISCORD_REDIRECT_URI,
      clientSecretLength: DISCORD_CLIENT_SECRET ? DISCORD_CLIENT_SECRET.length : 0
    });
    
    if (!code) {
      console.log('ERROR: Authorization code is missing');
      return res.status(400).json({ error: 'Authorization code is missing' });
    }

    console.log('Attempting OAuth2 token request with direct axios call...');
    
    // Exchange code for token using direct axios call instead of the library
    const tokenRequestData = {
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: DISCORD_REDIRECT_URI,
      scope: 'identify email guilds'
    };
    
    const tokenResponse = await axios.post(
      'https://discord.com/api/v10/oauth2/token',
      querystring.stringify(tokenRequestData),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    console.log('OAuth2 token request successful');
    
    // Get user info
    console.log('Getting user info...');
    const userResponse = await axios.get('https://discord.com/api/v10/users/@me', {
      headers: {
        'Authorization': `Bearer ${tokenResponse.data.access_token}`
      }
    });
    
    const user = userResponse.data;
    console.log('User data received:', { id: user.id, username: user.username });
    
    // Check if user is bot developer (admin)
    const isAdmin = user.id === DEVELOPER_ID;
    console.log(`User ID: ${user.id}, Developer ID: ${DEVELOPER_ID}, isAdmin: ${isAdmin}`);
    
    // Create JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        avatar: user.avatar,
        isAdmin 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ 
      token, 
      user: { 
        id: user.id, 
        username: user.username, 
        avatar: user.avatar,
        isAdmin 
      } 
    });
  } catch (error) {
    console.error('Auth error:', error);
    
    // Improved error logging
    if (error.response) {
      console.error('Discord API Error:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      });
    }
    
    res.status(500).json({ error: 'Authentication failed', details: error.message });
  }
});

// Protected routes
app.get('/api/stats', authenticateJWT, (req, res) => {
  // In a real implementation, this would get actual stats from the bot
  // For now, returning sample data
  res.json({
    servers: 3,
    users: 487,
    commands: 142,
    uptime: '3d 7h 22m',
    latency: '42ms',
    activeLoas: 2
  });
});

// Admin routes
app.get('/api/config', authenticateJWT, requireBotConfigAccess, (req, res) => {
  try {
    const staffConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, 'data/staff-config.json'), 'utf8'));
    res.json(staffConfig);
  } catch (error) {
    console.error('Error reading config:', error);
    res.status(500).json({ error: 'Failed to read configuration' });
  }
});

app.post('/api/config', authenticateJWT, requireBotConfigAccess, (req, res) => {
  try {
    const configPath = path.join(projectRoot, 'data/staff-config.json');
    fs.writeFileSync(configPath, JSON.stringify(req.body, null, 2));
    res.json({ success: true, message: 'Configuration updated successfully' });
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// LOA routes
app.get('/api/loa', authenticateJWT, (req, res) => {
  try {
    const loaPath = path.join(projectRoot, 'data/active-loas.json');
    if (!fs.existsSync(loaPath)) {
      return res.json([]);
    }
    
    const loas = JSON.parse(fs.readFileSync(loaPath, 'utf8'));
    
    // If user is not admin, filter to only show their LOAs
    if (req.user.id !== DEVELOPER_ID) {
      const userLoas = loas.filter(loa => loa.userId === req.user.id);
      return res.json(userLoas);
    }
    
    // Admin gets all LOAs
    res.json(loas);
  } catch (error) {
    console.error('Error reading LOA data:', error);
    res.status(500).json({ error: 'Failed to retrieve LOA data' });
  }
});

app.post('/api/loa', authenticateJWT, (req, res) => {
  try {
    const { startDate, endDate, reason, type, contact, isPrivate } = req.body;
    
    if (!startDate || !endDate || !reason || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const loaPath = path.join(projectRoot, 'data/active-loas.json');
    let loas = [];
    
    if (fs.existsSync(loaPath)) {
      loas = JSON.parse(fs.readFileSync(loaPath, 'utf8'));
    }
    
    // Generate a random ID for the LOA
    const generateId = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let id = 'LOA-';
      for (let i = 0; i < 6; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return id;
    };
    
    const newLoa = {
      id: generateId(),
      userId: req.user.id,
      username: req.user.username,
      startDate,
      endDate,
      reason,
      type,
      contact: contact || 'Not provided',
      isPrivate: isPrivate || false,
      createdAt: new Date().toISOString(),
      approved: false
    };
    
    loas.push(newLoa);
    fs.writeFileSync(loaPath, JSON.stringify(loas, null, 2));
    
    // Send to Discord
    try {
      sendMessage('loa', newLoa);
      console.log('LOA request queued for Discord notification');
    } catch (discordErr) {
      console.error('Error sending LOA to Discord:', discordErr);
      // Don't fail the request if Discord notification fails
    }
    
    res.json(newLoa);
  } catch (error) {
    console.error('Error creating LOA:', error);
    res.status(500).json({ error: 'Failed to create LOA' });
  }
});

app.post('/api/loa/:id/:action', authenticateJWT, (req, res) => {
  try {
    const { id, action } = req.params;
    
    if (!['approve', 'deny', 'delete'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    
    // Nur Admins können LOAs verwalten
    if (!['administrator', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Keine Berechtigung zum Verwalten von LOAs' });
    }
    
    const loaPath = path.join(projectRoot, 'data/active-loas.json');
    if (!fs.existsSync(loaPath)) {
      return res.status(404).json({ error: 'No LOAs found' });
    }
    
    let loas = JSON.parse(fs.readFileSync(loaPath, 'utf8'));
    const loaIndex = loas.findIndex(loa => loa.id === id);
    
    if (loaIndex === -1) {
      return res.status(404).json({ error: 'LOA not found' });
    }
    
    // Update the LOA status in the file first
    if (action === 'approve') {
      loas[loaIndex].approved = true;
      loas[loaIndex].denied = false;
    } else if (action === 'deny') {
      loas[loaIndex].approved = false;
      loas[loaIndex].denied = true;
    } else if (action === 'delete') {
      loas = loas.filter(loa => loa.id !== id);
    }
    
    fs.writeFileSync(loaPath, JSON.stringify(loas, null, 2));
    
    // Send an IPC message to Discord bot to update the LOA message
    try {
      const updatedLoa = action === 'delete' ? null : loas.find(loa => loa.id === id);
      sendMessage('loa_update', {
        loaId: id,
        action: action,
        loa: updatedLoa,
        updatedBy: req.user.username,
        updatedById: req.user.id
      });
      console.log(`LOA ${id} ${action} action queued for Discord sync`);
    } catch (syncError) {
      console.error(`Error queuing LOA sync for ${id}:`, syncError);
      // Continue with response even if sync fails
    }
    
    res.json({ success: true, action });
  } catch (error) {
    console.error(`Error ${req.params.action} LOA:`, error);
    res.status(500).json({ error: `Failed to ${req.params.action} LOA` });
  }
});

// Changelog routes
app.get('/api/changelogs', authenticateJWT, (req, res) => {
  try {
    const changelogPath = path.join(projectRoot, 'data/changelogs.json');
    if (!fs.existsSync(changelogPath)) {
      // Create empty file if it doesn't exist
      fs.writeFileSync(changelogPath, JSON.stringify([], null, 2));
      return res.json([]);
    }
    
    const changelogs = JSON.parse(fs.readFileSync(changelogPath, 'utf8'));
    
    // Wenn Benutzer kein Admin ist, zeige nur veröffentlichte Changelogs
    if (!['administrator', 'super_admin'].includes(req.user.role)) {
      const publishedChangelogs = changelogs.filter(log => log.isPublished);
      return res.json(publishedChangelogs);
    }
    
    // Admin gets all changelogs
    res.json(changelogs);
  } catch (error) {
    console.error('Error reading changelog data:', error);
    res.status(500).json({ error: 'Failed to retrieve changelog data' });
  }
});

app.post('/api/changelogs', authenticateJWT, requireChangelogAccess, (req, res) => {
  try {
    const { version, date, title, description, changes, isPublished } = req.body;
    
    if (!version || !date || !title || !changes || !Array.isArray(changes)) {
      return res.status(400).json({ error: 'Missing or invalid required fields' });
    }
    
    const changelogPath = path.join(projectRoot, 'data/changelogs.json');
    let changelogs = [];
    
    if (fs.existsSync(changelogPath)) {
      changelogs = JSON.parse(fs.readFileSync(changelogPath, 'utf8'));
    }
    
    const newChangelog = {
      id: `changelog-${Date.now()}`,
      version,
      date,
      title,
      description: description || '',
      changes,
      isPublished: isPublished || false,
      createdAt: new Date().toISOString(),
      createdBy: req.user.username
    };
    
    changelogs.unshift(newChangelog); // Add to the beginning of the array
    fs.writeFileSync(changelogPath, JSON.stringify(changelogs, null, 2));
    
    // Send to Discord if published
    if (isPublished) {
      try {
        sendMessage('changelog', newChangelog);
        console.log('Changelog queued for Discord notification');
      } catch (discordErr) {
        console.error('Error sending changelog to Discord:', discordErr);
        // Don't fail the request if Discord notification fails
      }
    }
    
    res.json(newChangelog);
  } catch (error) {
    console.error('Error creating changelog:', error);
    res.status(500).json({ error: 'Failed to create changelog' });
  }
});

app.patch('/api/changelogs/:id', authenticateJWT, requireChangelogAccess, (req, res) => {
  try {
    const { id } = req.params;
    const { isPublished } = req.body;
    
    const changelogPath = path.join(projectRoot, 'data/changelogs.json');
    if (!fs.existsSync(changelogPath)) {
      return res.status(404).json({ error: 'No changelogs found' });
    }
    
    let changelogs = JSON.parse(fs.readFileSync(changelogPath, 'utf8'));
    const changelogIndex = changelogs.findIndex(log => log.id === id);
    
    if (changelogIndex === -1) {
      return res.status(404).json({ error: 'Changelog not found' });
    }
    
    changelogs[changelogIndex].isPublished = isPublished;
    fs.writeFileSync(changelogPath, JSON.stringify(changelogs, null, 2));
    
    // Send to Discord if being published
    if (isPublished) {
      try {
        sendMessage('changelog', changelogs[changelogIndex]);
        console.log(`Changelog ${id} published and queued for Discord notification`);
      } catch (discordErr) {
        console.error('Error sending changelog to Discord:', discordErr);
        // Don't fail the request if Discord notification fails
      }
    }
    
    res.json({ success: true, changelog: changelogs[changelogIndex] });
  } catch (error) {
    console.error('Error updating changelog:', error);
    res.status(500).json({ error: 'Failed to update changelog' });
  }
});

app.delete('/api/changelogs/:id', authenticateJWT, requireChangelogAccess, (req, res) => {
  try {
    const { id } = req.params;
    
    const changelogPath = path.join(projectRoot, 'data/changelogs.json');
    if (!fs.existsSync(changelogPath)) {
      return res.status(404).json({ error: 'No changelogs found' });
    }
    
    let changelogs = JSON.parse(fs.readFileSync(changelogPath, 'utf8'));
    const filteredChangelogs = changelogs.filter(log => log.id !== id);
    
    if (filteredChangelogs.length === changelogs.length) {
      return res.status(404).json({ error: 'Changelog not found' });
    }
    
    fs.writeFileSync(changelogPath, JSON.stringify(filteredChangelogs, null, 2));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting changelog:', error);
    res.status(500).json({ error: 'Failed to delete changelog' });
  }
});

// ==================== SOCKET.IO ====================

// Socket.IO middleware for JWT authentication
io.use((socket, next) => {
  // Get token from socket handshake auth
  const token = socket.handshake.auth.token;
  if (!token) {
    console.log('Socket connection rejected: No token provided');
    return next(new Error('Authentication error: No token provided'));
  }
  
  // Verify token
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log('Socket connection rejected: Invalid token', err.message);
      return next(new Error('Authentication error: Invalid token'));
    }
    
    // Store user data in socket
    socket.user = decoded;
    console.log(`Socket authenticated for user: ${decoded.username} (${decoded.id}), isAdmin: ${decoded.isAdmin}`);
    next();
  });
});

io.on('connection', (socket) => {
  console.log(`New client connected: ${socket.user.username} (${socket.user.id})`);
  
  // Emit initial stats immediately
  const initialStats = getStats();
  console.log('Sending initial stats:', initialStats);
  socket.emit('stats', initialStats);
  
  // Start sending real-time stats updates
  startStatUpdates(socket);
  
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.user.username}`);
  });
});

// Für die Bot-Statistiken
let cachedStats = {
  servers: 0,
  users: 0,
  commands: 0,
  uptime: '0d 0h 0m',
  latency: '0ms',
  activeLoas: 0,
  lastUpdated: 0
};

// Diese Funktion wird vom Bot über IPC aufgerufen, um die Statistiken zu aktualisieren
function updateBotStats(stats) {
  console.log('Received updated stats from bot:', stats);
  
  // Updaten wir die gecachten Statistiken
  if (stats) {
    cachedStats = {
      ...cachedStats,
      ...stats,
      lastUpdated: Date.now()
    };
  }
}

// Registrieren des IPC-Handlers für Bot-Statistik-Updates
try {
  ipcModule.registerHandler('bot_stats_update', (data) => {
    updateBotStats(data);
    // Broadcast der neuen Statistiken an alle verbundenen Clients
    io.emit('stats', getStats());
    return { success: true };
  });
  console.log('Registered IPC handler for bot_stats_update');
} catch (error) {
  console.error('Failed to register IPC handler for bot stats:', error);
}

// Function to get stats data
function getStats() {
  try {
    // Count active LOAs
    let activeLoas = 0;
    const loaPath = path.join(projectRoot, 'data/active-loas.json');
    if (fs.existsSync(loaPath)) {
      const loas = JSON.parse(fs.readFileSync(loaPath, 'utf8'));
      activeLoas = loas.length;
    }
    
    // Verwenden der zwischengespeicherten Bot-Statistiken, aber stellen sicher, 
    // dass die neuesten LOA-Daten verwendet werden
    return {
      ...cachedStats,
      activeLoas: activeLoas
    };
  } catch (error) {
    console.error('Error getting stats:', error);
    return {
      servers: 0,
      users: 0,
      commands: 0,
      uptime: '0d 0h 0m',
      latency: '0ms',
      activeLoas: 0
    };
  }
}

// Function to start periodic stats updates
function startStatUpdates(socket) {
  // Periodic updates
  const interval = setInterval(() => {
    const stats = getStats();
    console.log('Sending updated stats:', stats);
    socket.emit('stats', stats);
  }, 5000);
  
  // Clean up interval on disconnect
  socket.on('disconnect', () => {
    clearInterval(interval);
  });
}

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Start IPC message processing
  console.log('Starting IPC message processing for bot stats');
  setInterval(async () => {
    try {
      const processed = await processMessages(async (type, data) => {
        if (type === 'bot_stats_update' && data) {
          console.log('Processing bot stats update:', data);
          // Update cached stats
          updateBotStats(data);
          
          // Broadcast updated stats to all connected clients
          io.emit('stats', getStats());
          return true;
        }
        else if (type === 'loa_status_update' && data) {
          console.log('Processing LOA status update:', data);
          // No need to update local data since it's already updated in JSON file
          // Just broadcast the update to all connected clients
          io.emit('loa_update', {
            loaId: data.loaId,
            action: data.action,
            updatedBy: data.updatedBy,
            timestamp: data.timestamp
          });
          console.log(`Broadcast LOA update for ID ${data.loaId}, action: ${data.action}`);
          return true;
        }
        return false; // Unhandled message type
      });
      
      if (processed > 0) {
        console.log(`Processed ${processed} IPC messages`);
      }
    } catch (error) {
      console.error('Error processing IPC messages:', error);
    }
  }, 2000); // Check every 2 seconds
}); 