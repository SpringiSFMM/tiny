import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Icons (SVG as components for better quality)
const DashboardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const SettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const DocumentIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const LogoutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

const ChevronIcon = ({ expanded }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const DashboardLayout = ({ children }) => {
  const { user, logout, isAdmin, userRole } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Navigation items
  const navItems = [
    { title: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
    { title: 'LOA Manager', path: '/loa', icon: <CalendarIcon /> },
  ];
  
  // Admin-only nav items
  const adminNavItems = [
    { title: 'Configuration', path: '/config', icon: <SettingsIcon />, requiredRole: 'super_admin' },
    { title: 'Changelog', path: '/changelog', icon: <DocumentIcon />, requiredRole: 'super_admin' },
  ];

  // Toggle sidebar on desktop
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  
  // Toggle mobile menu
  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);
  
  // Render nav items function
  const renderNavItems = (items) => (
    items.map((item) => (
      <li key={item.path}>
        <Link
          to={item.path}
          className={`flex items-center py-2.5 px-4 rounded-lg transition-all duration-200 ${location.pathname === item.path 
            ? 'bg-primary-600/20 text-primary-400 font-medium' 
            : 'text-surface-300 hover:bg-surface-700/50 hover:text-white'}`}
          onClick={() => setMobileMenuOpen(false)}
        >
          <span className="mr-3">{item.icon}</span>
          <span className={`${!sidebarOpen && 'hidden'} transition-opacity duration-200`}>
            {item.title}
          </span>
          {location.pathname === item.path && sidebarOpen && (
            <span className="ml-auto h-2 w-2 rounded-full bg-primary-400"></span>
          )}
        </Link>
      </li>
    ))
  );

  return (
    <div className="min-h-screen bg-surface-900 flex flex-col md:flex-row">
      {/* Mobile menu button */}
      <div className="md:hidden flex items-center justify-between p-4 bg-surface-800 border-b border-surface-700">
        <div className="flex items-center">
          <img 
            src={user?.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png'}
            alt="Logo"
            className="h-8 w-8 rounded-md mr-3"
          />
          <h1 className="text-lg font-bold text-white">Bot Dashboard</h1>
        </div>
        <button 
          onClick={toggleMobileMenu}
          className="p-1 rounded-md hover:bg-surface-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <MenuIcon />
        </button>
      </div>

      {/* Mobile navigation overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black bg-opacity-50" onClick={() => setMobileMenuOpen(false)}></div>
      )}
      
      {/* Sidebar - Desktop and Mobile */}
      <div 
        className={`${mobileMenuOpen ? 'fixed inset-y-0 left-0 z-50' : 'hidden md:flex'} 
        ${sidebarOpen ? 'w-64' : 'w-20'} 
        flex-col bg-surface-800 border-r border-surface-700 transition-all duration-300 ease-in-out
        shadow-xl md:shadow-none`}
      >
        {/* Sidebar Header with Toggle */}
        <div className="p-4 flex items-center justify-between border-b border-surface-700">
          <div className={`flex items-center ${!sidebarOpen && 'justify-center w-full'}`}>
            <img 
              src={user?.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png'}
              alt="Logo"
              className="h-9 w-9 rounded-md object-cover ring-2 ring-primary-500/30"
            />
            {sidebarOpen && (
              <h1 className="ml-3 text-lg font-bold text-white">Bot Dashboard</h1>
            )}
          </div>
          <button 
            onClick={toggleSidebar} 
            className="hidden md:flex p-1 rounded-md hover:bg-surface-700 focus:outline-none"
          >
            <ChevronIcon expanded={!sidebarOpen} />
          </button>
          <button 
            onClick={() => setMobileMenuOpen(false)} 
            className="md:hidden p-1 rounded-md hover:bg-surface-700 focus:outline-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 pt-5 pb-4 px-3 overflow-y-auto scrollbar-styled">
          <div className="space-y-1">
            <div className={`mb-2 ${!sidebarOpen && 'text-center'}`}>
              <span className="px-3 text-xs font-semibold text-surface-400 uppercase tracking-wider">
                {sidebarOpen ? 'Navigation' : '•••'}
              </span>
            </div>
            <ul className="space-y-1">
              {renderNavItems(navItems)}
            </ul>
            
            {(isAdmin || userRole === 'administrator' || userRole === 'super_admin') && (
              <>
                <div className={`mt-8 mb-2 ${!sidebarOpen && 'text-center'}`}>
                  <span className="px-3 text-xs font-semibold text-surface-400 uppercase tracking-wider">
                    {sidebarOpen ? 'Admin' : '•••'}
                  </span>
                </div>
                <ul className="space-y-1">
                  {renderNavItems(adminNavItems.filter(item => 
                    !item.requiredRole || 
                    item.requiredRole === userRole ||
                    (item.requiredRole === 'administrator' && userRole === 'super_admin')
                  ))}
                </ul>
              </>
            )}
          </div>
        </nav>
        
        {/* User Profile */}
        <div className="p-4 border-t border-surface-700">
          <div className={`flex items-center ${!sidebarOpen && 'justify-center'}`}>
            <img
              className="h-9 w-9 rounded-full ring-2 ring-white/10 object-cover"
              src={user?.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png'}
              alt="User avatar"
            />
            {sidebarOpen && (
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.username || 'User'}</p>
                <p className="text-xs text-surface-400">{user?.roleName || (isAdmin ? 'Administrator' : 'User')}</p>
              </div>
            )}
            {sidebarOpen ? (
              <button
                onClick={logout}
                className="ml-auto flex-shrink-0 bg-surface-700 hover:bg-surface-600 p-1.5 rounded-lg text-surface-300 hover:text-white transition-colors"
                title="Logout"
              >
                <LogoutIcon />
              </button>
            ) : (
              <button
                onClick={logout}
                className="mt-4 flex-shrink-0 bg-surface-700 hover:bg-surface-600 p-1.5 rounded-lg text-surface-300 hover:text-white transition-colors"
                title="Logout"
              >
                <LogoutIcon />
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Page header */}
        <header className="bg-surface-800/70 backdrop-blur-sm border-b border-surface-700 shadow-sm py-4 px-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-white">
              {navItems.find(item => item.path === location.pathname)?.title || 
               adminNavItems.find(item => item.path === location.pathname)?.title || 
               'Dashboard'}
            </h1>
            <div className="hidden md:block text-sm text-surface-400">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-primary-500/10 text-primary-400">
                <svg className="-ml-0.5 mr-1.5 h-2 w-2 text-primary-400" fill="currentColor" viewBox="0 0 8 8">
                  <circle cx="4" cy="4" r="3" />
                </svg>
                Online
              </span>
            </div>
          </div>
        </header>
        
        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-surface-800/50 backdrop-blur-sm border-t border-surface-700 py-3 px-6 text-center">
          <p className="text-xs text-surface-400">
            &copy; {new Date().getFullYear()} Bot Dashboard. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
};

export default DashboardLayout; 