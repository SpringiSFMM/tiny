import fs from 'fs';
import path from 'path';

// Pfad zur User-Rollen-Datenbank
const userRolesPath = path.join(process.cwd(), 'data', 'user-roles.json');

// Cache für die Rollen-Daten, um nicht bei jedem Request die Datei zu lesen
let rolesCache = null;
let rolesCacheTime = 0;

/**
 * Lädt die Benutzerrollen aus der Datei
 * @returns {Object} Das Benutzerrollen-Objekt
 */
export const getUserRoles = () => {
  // Cache erneuern, falls er älter als 60 Sekunden ist
  const now = Date.now();
  if (!rolesCache || now - rolesCacheTime > 60000) {
    try {
      const rolesData = fs.readFileSync(userRolesPath, 'utf8');
      rolesCache = JSON.parse(rolesData);
      rolesCacheTime = now;
    } catch (error) {
      console.error('Fehler beim Laden der Benutzerrollen:', error);
      return { roles: {}, users: { administrators: [], moderators: [] }, permissions: {} };
    }
  }
  return rolesCache;
};

/**
 * Findet die Rolle eines Benutzers basierend auf seiner Discord-ID oder seinem Benutzernamen
 * @param {string} userId Die Discord-ID oder der Benutzername
 * @returns {string|null} Die Rolle des Benutzers oder null, wenn nicht gefunden
 */
export const findUserRole = (userId) => {
  const { users } = getUserRoles();
  
  // Prüfe in den Administratoren
  const admin = users.administrators.find(user => user.id === userId || user.discord_id === userId);
  if (admin) return admin.role;
  
  // Prüfe in den Moderatoren
  const mod = users.moderators.find(user => user.id === userId || user.discord_id === userId);
  if (mod) return mod.role;
  
  // Standard-Benutzerrolle zurückgeben, falls nicht gefunden
  return 'user';
};

/**
 * Prüft, ob ein Benutzer eine bestimmte Berechtigung hat
 * @param {string} userId Die Discord-ID oder der Benutzername
 * @param {string} permission Die zu prüfende Berechtigung
 * @returns {boolean} True, wenn der Benutzer die Berechtigung hat
 */
export const hasPermission = (userId, permission) => {
  const { roles, permissions } = getUserRoles();
  const userRole = findUserRole(userId);
  
  if (!userRole || !roles[userRole]) return false;
  
  // Super-Admin hat immer alle Berechtigungen
  if (userRole === 'super_admin') return true;
  
  // Direkte Berechtigungen in der Rollendefiniton prüfen
  if (roles[userRole].permissions.includes(permission)) {
    return true;
  }
  
  // Prüfen von strukturierten Berechtigungen (z.B. files.upload)
  if (permission.includes('.')) {
    const [category, action] = permission.split('.');
    
    if (permissions && 
        permissions[category] && 
        permissions[category][action] && 
        permissions[category][action].includes(userRole)) {
      return true;
    }
  }
  
  return false;
};

/**
 * Middleware zum Prüfen der Benutzerrolle
 * @param {string} requiredRole Die erforderliche Rolle
 * @returns {function} Middleware-Funktion
 */
export const requireRole = (requiredRole) => {
  return (req, res, next) => {
    // Benutzer muss authentifiziert sein
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Nicht authentifiziert' });
    }
    
    const userRole = findUserRole(req.user.id);
    const { roles } = getUserRoles();
    
    // Spezialfall: Super-Admin hat immer Zugriff
    if (userRole === 'super_admin') {
      return next();
    }
    
    // Prüfen, ob die Benutzerrolle mit der erforderlichen Rolle übereinstimmt
    if (userRole === requiredRole) {
      return next();
    }
    
    // Zugriffserlaubnis verweigern
    return res.status(403).json({ 
      error: 'Zugriff verweigert', 
      message: `Für diese Aktion ist die Rolle ${roles[requiredRole].name} erforderlich` 
    });
  };
};

/**
 * Middleware zum Prüfen einer bestimmten Berechtigung
 * @param {string} permission Die erforderliche Berechtigung
 * @returns {function} Middleware-Funktion
 */
export const requirePermission = (permission) => {
  return (req, res, next) => {
    // Benutzer muss authentifiziert sein
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Nicht authentifiziert' });
    }
    
    // Prüfen, ob der Benutzer die erforderliche Berechtigung hat
    if (hasPermission(req.user.id, permission)) {
      return next();
    }
    
    // Zugriffserlaubnis verweigern
    return res.status(403).json({ 
      error: 'Zugriff verweigert', 
      message: `Für diese Aktion ist die Berechtigung '${permission}' erforderlich` 
    });
  };
};

/**
 * Middleware zum Prüfen der Bot-Konfigurationsberechtigungen
 * Nur springi_sfm (super_admin) darf die Bot-Konfiguration bearbeiten
 */
export const requireBotConfigAccess = (req, res, next) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Nicht authentifiziert' });
  }
  
  // Bearbeiten ist nur für super_admin (springi_sfm) erlaubt
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
    if (hasPermission(req.user.id, 'bot_config.edit')) {
      return next();
    }
    return res.status(403).json({ 
      error: 'Zugriff verweigert', 
      message: 'Nur springi_sfm kann die Bot-Konfiguration bearbeiten' 
    });
  }
  
  // Anzeigen ist für Administratoren und super_admin erlaubt
  if (hasPermission(req.user.id, 'bot_config.view')) {
    return next();
  }
  
  return res.status(403).json({ 
    error: 'Zugriff verweigert', 
    message: 'Sie haben keine Berechtigung, die Bot-Konfiguration anzuzeigen' 
  });
};

/**
 * Middleware zum Prüfen der Changelog-Berechtigungen
 * Nur springi_sfm (super_admin) darf Changelogs erstellen
 */
export const requireChangelogAccess = (req, res, next) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Nicht authentifiziert' });
  }
  
  const { method } = req;
  
  // Erstellen und Löschen ist nur für super_admin (springi_sfm) erlaubt
  if (method === 'POST' && !hasPermission(req.user.id, 'changelogs.create')) {
    return res.status(403).json({ 
      error: 'Zugriff verweigert', 
      message: 'Nur springi_sfm kann Changelogs erstellen' 
    });
  }
  
  if (method === 'DELETE' && !hasPermission(req.user.id, 'changelogs.delete')) {
    return res.status(403).json({ 
      error: 'Zugriff verweigert', 
      message: 'Nur springi_sfm kann Changelogs löschen' 
    });
  }
  
  // Bearbeiten ist für super_admin und Administratoren erlaubt
  if ((method === 'PUT' || method === 'PATCH') && !hasPermission(req.user.id, 'changelogs.edit')) {
    return res.status(403).json({ 
      error: 'Zugriff verweigert', 
      message: 'Sie haben keine Berechtigung, Changelogs zu bearbeiten' 
    });
  }
  
  // Alle können Changelogs lesen
  return next();
};

/**
 * Fügt Rollen- und Berechtigungsinformationen zur Anfrage hinzu
 */
export const attachRoleInfo = (req, res, next) => {
  if (req.user && req.user.id) {
    const userRole = findUserRole(req.user.id);
    const { roles } = getUserRoles();
    
    // Rolle und Berechtigungen dem Request-Objekt hinzufügen
    req.userRole = userRole;
    req.userPermissions = roles[userRole]?.permissions || [];
    
    // Info für das Frontend
    req.user.role = userRole;
    req.user.roleName = roles[userRole]?.name || 'Benutzer';
  }
  
  next();
};