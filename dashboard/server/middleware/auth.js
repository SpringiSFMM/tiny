import jwt from 'jsonwebtoken';
import { findUserRole, attachRoleInfo } from './roleBasedAuth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production';

// Middleware zum Verifizieren des JWT Tokens
export const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Kein Token bereitgestellt' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // User-Informationen aus dem Token werden der Request hinzugefügt
    
    // Benutzerrolle ermitteln und hinzufügen
    const userRole = findUserRole(req.user.id);
    req.user.role = userRole;
    
    // Weitere Rolleninformationen anhängen
    attachRoleInfo(req, res, next);
  } catch (error) {
    console.error('Ungültiger Token:', error.message);
    return res.status(401).json({ error: 'Ungültiger oder abgelaufener Token' });
  }
};

// Middleware zum Prüfen von Admin-Berechtigungen
export const verifyAdmin = (req, res, next) => {
  // Admin-Rolle basierend auf dem neuen Rollensystem
  if (req.user.role !== 'administrator' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Zugriff verweigert: Admin-Berechtigung erforderlich' });
  }
  next();
};

// Middleware zum Prüfen von Super-Admin-Berechtigungen (nur springi_sfm)
export const verifySuperAdmin = (req, res, next) => {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Zugriff verweigert: Super-Admin-Berechtigung erforderlich' });
  }
  next();
};

// Middleware zum Prüfen von Moderator-Berechtigungen (oder höher)
export const verifyModerator = (req, res, next) => {
  if (!['moderator', 'administrator', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Zugriff verweigert: Mindestens Moderator-Berechtigung erforderlich' });
  }
  next();
};
