import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

// Create context
const AuthContext = createContext(null);

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [permissions, setPermissions] = useState([]);

  // Check for existing token on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          // Parse the token (JWT) to get user info
          const payload = JSON.parse(atob(token.split('.')[1]));
          console.log('Token payload:', payload);
          
          // Check if token is expired
          if (payload.exp * 1000 < Date.now()) {
            console.log('Token expired');
            localStorage.removeItem('token');
            setIsAuthenticated(false);
          } else {
            // Set user from token
            const userData = {
              id: payload.id,
              username: payload.username,
              avatar: payload.avatar,
              isAdmin: payload.isAdmin || false, // Legacy isAdmin flag
              role: payload.role || (payload.isAdmin ? 'super_admin' : 'user'),
              roleName: payload.roleName || 'Benutzer',
              permissions: payload.permissions || []
            };
            
            setUser(userData);
            
            // Set additional state for roles and permissions
            console.log(`Setting role: ${userData.role}, isAdmin flag: ${payload.isAdmin || false}`);
            setIsAdmin(payload.isAdmin || false);
            setUserRole(userData.role);
            setPermissions(userData.permissions);
            setIsAuthenticated(true);
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
        localStorage.removeItem('token');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Login function - exchanges Discord code for JWT
  const login = async (code) => {
    try {
      setIsLoading(true);
      console.log('Attempting login with code:', code.substring(0, 5) + '...');
      
      // Exchange code for token with backend
      console.log('Sending request to /api/auth/token');
      const response = await axios.post('/api/auth/token', { code }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Token response received:', response.status);
      
      // Store token
      localStorage.setItem('token', response.data.token);
      
      // Set user from response
      setUser(response.data.user);
      setIsAdmin(response.data.user.isAdmin || false);
      setUserRole(response.data.user.role || (response.data.user.isAdmin ? 'super_admin' : 'user'));
      setPermissions(response.data.user.permissions || []);
      setIsAuthenticated(true);
      
      return true;
    } catch (error) {
      console.error('Login error:', error);
      
      // More detailed error logging
      if (error.response) {
        console.error('Error response:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        });
      } else if (error.request) {
        console.error('No response received:', error.request);
      } else {
        console.error('Error setting up request:', error.message);
      }
      
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setIsAuthenticated(false);
    setIsAdmin(false);
    setUserRole(null);
    setPermissions([]);
  };

  // Get authorization header
  const getAuthHeader = () => {
    const token = localStorage.getItem('token');
    return {
      Authorization: `Bearer ${token}`
    };
  };

  // Context value
  const value = {
    user,
    isAuthenticated,
    isLoading,
    isAdmin,
    userRole,
    permissions,
    login,
    logout,
    getAuthHeader,
    // Hilfsfunktion zum Prüfen von Berechtigungen
    hasPermission: (permission) => {
      // Super_admin hat immer Zugriff
      if (userRole === 'super_admin') return true;
      
      // Direkte Berechtigungsprüfung
      if (permissions?.includes(permission)) return true;
      
      return false;
    },
    // Hilfsfunktion zum Prüfen der Rolle
    hasRole: (roles) => {
      // Prüfen, ob die aktuelle Rolle in der Liste der erlaubten Rollen ist
      if (!userRole || !roles) return false;
      if (Array.isArray(roles)) return roles.includes(userRole);
      return roles === userRole;
    }
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext; 