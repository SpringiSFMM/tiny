import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

// SVG Icons as components
const ServerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
  </svg>
);

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const CommandIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const TimeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-warning-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const NetworkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-error-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

// StatCard component for consistent card design
const StatCard = ({ icon, title, value, description, trend }) => (
  <div className="card card-hover flex flex-col h-full">
    <div className="flex items-start justify-between mb-4">
      <div className="p-3 rounded-lg bg-surface-700/50">
        {icon}
      </div>
      {trend && (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium 
          ${trend > 0 ? 'bg-accent-500/20 text-accent-300' : 'bg-error-500/20 text-error-300'}`}>
          <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path 
              d={trend > 0 
                ? "M7 14l5-5 5 5" 
                : "M7 10l5 5 5-5"} 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
          </svg>
          {Math.abs(trend)}%
        </span>
      )}
    </div>
    <div className="mb-2">
      <h3 className="text-lg font-medium text-white">{title}</h3>
      <p className="text-3xl font-bold mt-2">{value}</p>
    </div>
    <p className="text-sm text-surface-400 mt-auto">{description}</p>
  </div>
);

// Real-time stats dashboard
const Dashboard = () => {
  const { getAuthHeader, isAuthenticated, user, isAdmin } = useAuth();
  const [stats, setStats] = useState({
    servers: 0,
    users: 0,
    commands: 0,
    uptime: '0h',
    latency: '0ms',
    activeLoas: 0
  });
  const [isConnected, setIsConnected] = useState(false);
  const [recentActivity, setRecentActivity] = useState([]);
  
  // Connect to socket.io
  useEffect(() => {
    if (!isAuthenticated) return;
    
    // Get token from local storage
    const token = localStorage.getItem('token');
    
    // Connect to socket.io server with auth token
    const socket = io({
      auth: { token }
    });
    
    socket.on('connect', () => {
      console.log('Connected to socket.io server');
      setIsConnected(true);
    });
    
    socket.on('stats', (data) => {
      console.log('Received stats update:', data);
      setStats(data);
    });
    
    socket.on('activity', (data) => {
      setRecentActivity(prev => [data, ...prev].slice(0, 5));
    });
    
    socket.on('disconnect', () => {
      console.log('Disconnected from socket.io server');
      setIsConnected(false);
    });
    
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
    });
    
    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated]);
  
  // Mock activity data for UI demonstration
  useEffect(() => {
    if (recentActivity.length === 0) {
      setRecentActivity([
        { id: 1, type: 'loa', user: 'StaffMember1', action: 'created new LOA', time: '10 minutes ago' },
        { id: 2, type: 'command', user: 'ServerMod', action: 'used /staff-return', time: '25 minutes ago' },
        { id: 3, type: 'system', user: 'System', action: 'restarted bot services', time: '1 hour ago' }
      ]);
    }
  }, []);

  // Get activity icon based on type
  const getActivityIcon = (type) => {
    // Verschiedene Icon-Styles für jeden Aktivitätstyp
    switch(type) {
      case 'loa':
        return (
          <div className="w-8 h-full flex items-center justify-center">
            <div className="w-1 h-full rounded-full bg-orange-500"></div>
          </div>
        );
      case 'command':
        return (
          <div className="w-8 h-full flex items-center justify-center">
            <div className="w-1 h-full rounded-full bg-purple-500"></div>
          </div>
        );
      case 'system':
        return (
          <div className="w-8 h-full flex items-center justify-center">
            <div className="w-1 h-full rounded-full bg-blue-500"></div>
          </div>
        );
      default:
        return (
          <div className="w-8 h-full flex items-center justify-center">
            <div className="w-1 h-full rounded-full bg-surface-400"></div>
          </div>
        );
    }
  };
  
  return (
    <div className="space-y-8">
      {/* Welcome section with greeting and stats summary */}
      <div className="card card-glass bg-gradient-to-br from-surface-800 to-surface-900 border-surface-700 shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Welcome back, <span className="text-primary-400">{user?.username || 'User'}</span>!
            </h1>
            <p className="mt-2 text-surface-300 max-w-lg">
              Monitor your bot performance, manage staff leave of absence requests, and access administrative functions from this dashboard.
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center bg-surface-800/80 rounded-lg px-3 py-1.5">
            <div className={`h-2.5 w-2.5 rounded-full mr-2 ${isConnected ? 'bg-accent-500 pulse-animation' : 'bg-error-500'}`}></div>
            <span className={`text-sm ${isConnected ? 'text-accent-400' : 'text-error-400'}`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard 
          icon={<ServerIcon />}
          title="Discord Servers"
          value={stats.servers}
          description="Active bot installations"
          trend={2.5}
        />
        
        <StatCard 
          icon={<UserIcon />}
          title="Total Members"
          value={stats.users.toLocaleString()}
          description="Users across all servers"
          trend={3.8}
        />
        
        <StatCard 
          icon={<CommandIcon />}
          title="Commands Used"
          value={stats.commands}
          description="Commands executed today"
          trend={-1.2}
        />
        
        <StatCard 
          icon={<TimeIcon />}
          title="Uptime"
          value={stats.uptime}
          description="Since last restart"
        />
        
        <StatCard 
          icon={<NetworkIcon />}
          title="API Latency"
          value={stats.latency}
          description="Average response time"
        />
        
        <StatCard 
          icon={<CalendarIcon />}
          title="Active LOAs"
          value={stats.activeLoas}
          description="Staff currently on leave"
          trend={5.0}
        />
      </div>
      
      {/* Recent activity section */}
      <div className="card">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
          <button className="btn-sm btn-outline flex items-center gap-1 text-xs">View All</button>
        </div>
        
        <div className="space-y-4">
          {recentActivity.map((activity) => (
            <div key={activity.id} className="flex items-stretch gap-2 pb-4 border-b border-surface-700/50 last:border-0 last:pb-0 min-h-[3rem]">
              {getActivityIcon(activity.type)}
              <div className="flex-1 min-w-0 py-1">
                <p className="text-sm text-white">
                  <span className="font-medium text-primary-400">{activity.user}</span> {activity.action}
                </p>
                <p className="text-xs text-surface-400">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Quick links section for staff and admins */}
      <div className="card bg-gradient-to-r from-primary-900/30 to-surface-800 border-primary-800/30">
        <h2 className="text-lg font-semibold text-white mb-4">Quick Access</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a href="/loa" className="p-4 rounded-lg bg-surface-700/50 hover:bg-surface-700 transition-colors flex flex-col items-center text-center">
            <CalendarIcon />
            <span className="mt-2 text-sm font-medium text-white">LOA Manager</span>
          </a>
          
          <a href="/files" className="p-4 rounded-lg bg-surface-700/50 hover:bg-surface-700 transition-colors flex flex-col items-center text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <span className="mt-2 text-sm font-medium text-white">Dateimanager</span>
          </a>
          
          {isAdmin && (
            <>
              <a href="/config" className="p-4 rounded-lg bg-surface-700/50 hover:bg-surface-700 transition-colors flex flex-col items-center text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="mt-2 text-sm font-medium text-white">Bot Config</span>
              </a>
              
              <a href="/changelog" className="p-4 rounded-lg bg-surface-700/50 hover:bg-surface-700 transition-colors flex flex-col items-center text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="mt-2 text-sm font-medium text-white">Changelog</span>
              </a>
            </>
          )}
          
          <a href="https://discord.gg/support" target="_blank" rel="noopener noreferrer" className="p-4 rounded-lg bg-surface-700/50 hover:bg-surface-700 transition-colors flex flex-col items-center text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-discord-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="mt-2 text-sm font-medium text-white">Support Server</span>
          </a>
        </div>
      </div>
      
      {/* Custom CSS for pulse animation */}
      <style dangerouslySetInnerHTML={{ __html: `
        .pulse-animation {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: .5;
          }
        }
      `}} />
    </div>
  );
};

export default Dashboard; 