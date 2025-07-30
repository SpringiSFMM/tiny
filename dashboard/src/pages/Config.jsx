import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const Config = () => {
  const { getAuthHeader, user } = useAuth();
  const isAdmin = user?.isAdmin;
  
  const [config, setConfig] = useState({
    botName: 'Tiny Bot',
    staffRoleId: '',
    developerRoleId: '',
    loaRoleId: '',
    loaChannelId: '',
    allowedBugManagementRoles: []
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  useEffect(() => {
    const loadConfig = async () => {
      if (!isAdmin) return;
      
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const response = await axios.get('http://localhost:3001/api/config', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setConfig(response.data);
      } catch (err) {
        console.error('Error loading configuration:', err);
        setError('Failed to load configuration. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    loadConfig();
  }, [getAuthHeader, isAdmin]);
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleRoleIdChange = (index, value) => {
    const updatedRoles = [...config.allowedBugManagementRoles];
    updatedRoles[index] = value;
    setConfig(prev => ({
      ...prev,
      allowedBugManagementRoles: updatedRoles
    }));
  };
  
  const addRoleId = () => {
    setConfig(prev => ({
      ...prev,
      allowedBugManagementRoles: [...prev.allowedBugManagementRoles, '']
    }));
  };
  
  const removeRoleId = (index) => {
    const updatedRoles = [...config.allowedBugManagementRoles];
    updatedRoles.splice(index, 1);
    setConfig(prev => ({
      ...prev,
      allowedBugManagementRoles: updatedRoles
    }));
  };
  
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    
    try {
      setIsSaving(true);
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:3001/api/config', config, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setSuccess('Configuration saved successfully!');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      console.error('Error saving configuration:', err);
      setError('Failed to save configuration. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  if (!isAdmin) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6 text-white">Bot Configuration</h1>
        <div className="card">
          <p className="text-red-500">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-white">Bot Configuration</h1>
      
      {/* Success message */}
      {success && (
        <div className="bg-green-600 text-white p-3 rounded-md mb-4">
          {success}
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <div className="bg-red-600 text-white p-3 rounded-md mb-4">
          {error}
          <button 
            onClick={() => setError(null)} 
            className="ml-2 font-bold"
          >
            ×
          </button>
        </div>
      )}
      
      {loading ? (
        <div className="card">
          <p className="text-slate-300">Loading configuration...</p>
        </div>
      ) : (
        <form onSubmit={handleSaveConfig}>
          <div className="card mb-6">
            <h2 className="text-xl font-bold text-white mb-4">General Settings</h2>
            
            <div className="mb-4">
              <label className="block text-slate-300 mb-1">Bot Name</label>
              <input
                type="text"
                name="botName"
                value={config.botName || ''}
                onChange={handleInputChange}
                className="w-full p-2 rounded-md bg-slate-800 text-white border border-slate-700"
              />
            </div>
          </div>
          
          <div className="card mb-6">
            <h2 className="text-xl font-bold text-white mb-4">Role Settings</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="mb-4">
                <label className="block text-slate-300 mb-1">Staff Role ID</label>
                <input
                  type="text"
                  name="staffRoleId"
                  value={config.staffRoleId || ''}
                  onChange={handleInputChange}
                  placeholder="1307038473861071012"
                  className="w-full p-2 rounded-md bg-slate-800 text-white border border-slate-700"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-slate-300 mb-1">Developer Role ID</label>
                <input
                  type="text"
                  name="developerRoleId"
                  value={config.developerRoleId || ''}
                  onChange={handleInputChange}
                  placeholder="1370725982318891048"
                  className="w-full p-2 rounded-md bg-slate-800 text-white border border-slate-700"
                />
              </div>
            </div>
          </div>
          
          <div className="card mb-6">
            <h2 className="text-xl font-bold text-white mb-4">LOA Settings</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="mb-4">
                <label className="block text-slate-300 mb-1">LOA Role ID</label>
                <input
                  type="text"
                  name="loaRoleId"
                  value={config.loaRoleId || ''}
                  onChange={handleInputChange}
                  placeholder="1307038473861071012"
                  className="w-full p-2 rounded-md bg-slate-800 text-white border border-slate-700"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-slate-300 mb-1">LOA Channel ID</label>
                <input
                  type="text"
                  name="loaChannelId"
                  value={config.loaChannelId || ''}
                  onChange={handleInputChange}
                  placeholder="1307038560226119731"
                  className="w-full p-2 rounded-md bg-slate-800 text-white border border-slate-700"
                />
              </div>
            </div>
          </div>
          
          <div className="card mb-6">
            <h2 className="text-xl font-bold text-white mb-4">Bug Management Roles</h2>
            <p className="text-slate-400 mb-4">Specify role IDs that are allowed to manage bug reports</p>
            
            {config.allowedBugManagementRoles.map((roleId, index) => (
              <div key={index} className="flex items-center mb-2">
                <input
                  type="text"
                  value={roleId}
                  onChange={(e) => handleRoleIdChange(index, e.target.value)}
                  className="flex-grow p-2 rounded-md bg-slate-800 text-white border border-slate-700"
                  placeholder="Role ID"
                />
                <button
                  type="button"
                  onClick={() => removeRoleId(index)}
                  className="ml-2 bg-red-600 hover:bg-red-700 text-white px-2 py-2 rounded-md"
                >
                  ×
                </button>
              </div>
            ))}
            
            <button
              type="button"
              onClick={addRoleId}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm mt-2"
            >
              + Add Role
            </button>
          </div>
          
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default Config;