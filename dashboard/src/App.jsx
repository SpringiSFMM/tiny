import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Layouts
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Config from './pages/Config';
import LoaManager from './pages/LoaManager';
import FileManager from './pages/FileManager';
import ChangelogBuilder from './pages/ChangelogBuilder';
import AuthCallback from './pages/AuthCallback';

// Protected route component
const ProtectedRoute = ({ element }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  return isAuthenticated ? element : <Navigate to="/login" />;
};

// Admin route component
const AdminRoute = ({ element }) => {
  const { isAuthenticated, isAdmin, isLoading, userRole } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  // Prüfen, ob der Benutzer Admin-Rechte hat (legacy oder rollenbasiert)
  const hasAdminAccess = isAdmin || userRole === 'administrator' || userRole === 'super_admin';
  
  return isAuthenticated && hasAdminAccess ? element : <Navigate to="/dashboard" />;
};

// Rollenbasierte Route
const RoleRoute = ({ element, requiredRoles }) => {
  const { isAuthenticated, isLoading, userRole } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  // Prüfen, ob die Rolle des Benutzers in den erforderlichen Rollen enthalten ist
  const hasAccess = requiredRoles.includes(userRole);
  
  return isAuthenticated && hasAccess ? element : <Navigate to="/dashboard" />;
};

// Super-Admin Route (nur für springi_sfm)
const SuperAdminRoute = ({ element }) => {
  const { isAuthenticated, isLoading, userRole } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  return isAuthenticated && userRole === 'super_admin' ? element : <Navigate to="/dashboard" />;
};

function App() {
  return (
    <Routes>
      {/* Auth routes */}
      <Route 
        path="/login" 
        element={
          <AuthLayout>
            <Login />
          </AuthLayout>
        } 
      />
      <Route 
        path="/auth/callback" 
        element={
          <AuthLayout>
            <AuthCallback />
          </AuthLayout>
        } 
      />
      
      {/* Protected routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute 
            element={
              <DashboardLayout>
                <Dashboard />
              </DashboardLayout>
            } 
          />
        }
      />
      <Route
        path="/loa"
        element={
          <ProtectedRoute 
            element={
              <DashboardLayout>
                <LoaManager />
              </DashboardLayout>
            } 
          />
        }
      />
      <Route
        path="/files"
        element={
          <ProtectedRoute 
            element={
              <DashboardLayout>
                <FileManager />
              </DashboardLayout>
            } 
          />
        }
      />
      
      {/* Admin routes */}
              <Route
        path="/config"
        element={
          <SuperAdminRoute 
            element={
              <DashboardLayout>
                <Config />
              </DashboardLayout>
            } 
          />
        }
      />
      <Route
        path="/changelog"
        element={
          <SuperAdminRoute 
            element={
              <DashboardLayout>
                <ChangelogBuilder />
              </DashboardLayout>
            } 
          />
        }
      />
      
      {/* Default redirect to dashboard or login */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App; 