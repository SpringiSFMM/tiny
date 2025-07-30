import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const ChangelogBuilder = () => {
  const { getAuthHeader, user } = useAuth();
  const isAdmin = user?.isAdmin;
  
  const [changelogs, setChangelogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  
  const [newChangelog, setNewChangelog] = useState({
    version: '',
    date: new Date().toISOString().split('T')[0],
    title: '',
    description: '',
    changes: [{ type: 'added', description: '' }],
    isPublished: false
  });
  
  useEffect(() => {
    const fetchChangelogs = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const response = await axios.get('http://localhost:3001/api/changelogs', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setChangelogs(response.data || []);
      } catch (err) {
        console.error('Error fetching changelogs:', err);
        setError('Failed to load changelogs. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchChangelogs();
  }, [getAuthHeader]);
  
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNewChangelog(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  const handleChangeItemUpdate = (index, field, value) => {
    const updatedChanges = [...newChangelog.changes];
    updatedChanges[index] = { ...updatedChanges[index], [field]: value };
    setNewChangelog(prev => ({
      ...prev,
      changes: updatedChanges
    }));
  };
  
  const addChangeItem = () => {
    setNewChangelog(prev => ({
      ...prev,
      changes: [...prev.changes, { type: 'added', description: '' }]
    }));
  };
  
  const removeChangeItem = (index) => {
    const updatedChanges = [...newChangelog.changes];
    updatedChanges.splice(index, 1);
    setNewChangelog(prev => ({
      ...prev,
      changes: updatedChanges
    }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    
    try {
      const payload = {
        ...newChangelog,
        date: new Date(newChangelog.date).toISOString()
      };
      
      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:3001/api/changelogs', payload, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setChangelogs(prev => [response.data, ...prev]);
      setSuccess('Changelog created successfully!');
      
      // Reset form
      setNewChangelog({
        version: '',
        date: new Date().toISOString().split('T')[0],
        title: '',
        description: '',
        changes: [{ type: 'added', description: '' }],
        isPublished: false
      });
      
      setShowForm(false);
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      console.error('Error creating changelog:', err);
      setError('Failed to create changelog. Please try again.');
    }
  };
  
  const togglePublish = async (id, currentStatus) => {
    if (!isAdmin) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`http://localhost:3001/api/changelogs/${id}`, 
        { isPublished: !currentStatus },
        { headers: {
          Authorization: `Bearer ${token}`
        }}
      );
      
      setChangelogs(prev => prev.map(log => 
        log.id === id ? { ...log, isPublished: !currentStatus } : log
      ));
      
      setSuccess(`Changelog ${!currentStatus ? 'published' : 'unpublished'} successfully!`);
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      console.error('Error updating changelog status:', err);
      setError('Failed to update changelog status. Please try again.');
    }
  };
  
  const deleteChangelog = async (id) => {
    if (!isAdmin || !window.confirm('Are you sure you want to delete this changelog?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:3001/api/changelogs/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setChangelogs(prev => prev.filter(log => log.id !== id));
      setSuccess('Changelog deleted successfully!');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      console.error('Error deleting changelog:', err);
      setError('Failed to delete changelog. Please try again.');
    }
  };
  
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  if (!isAdmin) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6 text-white">Changelog Builder</h1>
        <div className="card">
          <p className="text-red-500">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-white">Changelog Builder</h1>
      
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
      
      {/* Create changelog button */}
      <div className="mb-6">
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
        >
          {showForm ? 'Cancel' : 'Create New Changelog'}
        </button>
      </div>
      
      {/* Create changelog form */}
      {showForm && (
        <div className="card mb-6">
          <h2 className="text-xl font-bold text-white mb-4">New Changelog</h2>
          
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-slate-300 mb-1">Version *</label>
                <input
                  type="text"
                  name="version"
                  value={newChangelog.version}
                  onChange={handleInputChange}
                  placeholder="e.g. 1.0.0"
                  required
                  className="w-full p-2 rounded-md bg-slate-800 text-white border border-slate-700"
                />
              </div>
              
              <div>
                <label className="block text-slate-300 mb-1">Date *</label>
                <input
                  type="date"
                  name="date"
                  value={newChangelog.date}
                  onChange={handleInputChange}
                  required
                  className="w-full p-2 rounded-md bg-slate-800 text-white border border-slate-700"
                />
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-slate-300 mb-1">Title *</label>
              <input
                type="text"
                name="title"
                value={newChangelog.title}
                onChange={handleInputChange}
                placeholder="e.g. Major Update with New Features"
                required
                className="w-full p-2 rounded-md bg-slate-800 text-white border border-slate-700"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-slate-300 mb-1">Description</label>
              <textarea
                name="description"
                value={newChangelog.description}
                onChange={handleInputChange}
                rows="3"
                placeholder="General description of this update"
                className="w-full p-2 rounded-md bg-slate-800 text-white border border-slate-700"
              ></textarea>
            </div>
            
            <div className="mb-4">
              <label className="block text-slate-300 mb-2">Changes *</label>
              
              {newChangelog.changes.map((change, index) => (
                <div key={index} className="flex items-start mb-2">
                  <select
                    value={change.type}
                    onChange={(e) => handleChangeItemUpdate(index, 'type', e.target.value)}
                    className="p-2 rounded-md bg-slate-800 text-white border border-slate-700 mr-2 w-28"
                  >
                    <option value="added">Added</option>
                    <option value="changed">Changed</option>
                    <option value="fixed">Fixed</option>
                    <option value="removed">Removed</option>
                  </select>
                  
                  <input
                    type="text"
                    value={change.description}
                    onChange={(e) => handleChangeItemUpdate(index, 'description', e.target.value)}
                    placeholder="Change description"
                    required
                    className="flex-grow p-2 rounded-md bg-slate-800 text-white border border-slate-700"
                  />
                  
                  <button
                    type="button"
                    onClick={() => removeChangeItem(index)}
                    className="ml-2 bg-red-600 hover:bg-red-700 text-white px-2 py-2 rounded-md"
                  >
                    ×
                  </button>
                </div>
              ))}
              
              <button
                type="button"
                onClick={addChangeItem}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm mt-2"
              >
                + Add Change
              </button>
            </div>
            
            <div className="mb-6 flex items-center">
              <input
                type="checkbox"
                name="isPublished"
                id="isPublished"
                checked={newChangelog.isPublished}
                onChange={handleInputChange}
                className="mr-2"
              />
              <label htmlFor="isPublished" className="text-slate-300">
                Publish immediately
              </label>
            </div>
            
            <div className="flex justify-end">
              <button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
              >
                Create Changelog
              </button>
            </div>
          </form>
        </div>
      )}
      
      {/* Changelog List */}
      <div className="card">
        <h2 className="text-xl font-bold text-white mb-4">Existing Changelogs</h2>
        
        {loading ? (
          <p className="text-slate-300">Loading changelogs...</p>
        ) : changelogs.length === 0 ? (
          <p className="text-slate-300">No changelogs found.</p>
        ) : (
          <div className="space-y-6">
            {changelogs.map((changelog) => (
              <div 
                key={changelog.id} 
                className="border border-slate-700 rounded-md p-4 bg-slate-800"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      v{changelog.version} - {changelog.title}
                    </h3>
                    <p className="text-slate-400">
                      {formatDate(changelog.date)}
                    </p>
                    {changelog.description && (
                      <p className="text-slate-300 mt-2 mb-3">{changelog.description}</p>
                    )}
                    
                    <ul className="space-y-1 mt-3">
                      {changelog.changes.map((change, idx) => (
                        <li key={idx} className="flex items-start">
                          <span className={`
                            inline-block w-16 text-xs font-medium mr-2 px-2 py-1 rounded text-center
                            ${change.type === 'added' ? 'bg-green-700 text-green-100' : ''}
                            ${change.type === 'changed' ? 'bg-blue-700 text-blue-100' : ''}
                            ${change.type === 'fixed' ? 'bg-yellow-700 text-yellow-100' : ''}
                            ${change.type === 'removed' ? 'bg-red-700 text-red-100' : ''}
                          `}>
                            {change.type.charAt(0).toUpperCase() + change.type.slice(1)}
                          </span>
                          <span className="text-slate-300">{change.description}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div>
                    <span className={`px-3 py-1 rounded-md text-sm font-medium ${changelog.isPublished ? 'bg-green-600 text-white' : 'bg-gray-600 text-white'}`}>
                      {changelog.isPublished ? 'Published' : 'Draft'}
                    </span>
                  </div>
                </div>
                
                <div className="mt-4 flex space-x-2">
                  <button
                    onClick={() => togglePublish(changelog.id, changelog.isPublished)}
                    className={`${changelog.isPublished ? 'bg-gray-600' : 'bg-green-600'} hover:${changelog.isPublished ? 'bg-gray-700' : 'bg-green-700'} text-white px-3 py-1 rounded-md text-sm`}
                  >
                    {changelog.isPublished ? 'Unpublish' : 'Publish'}
                  </button>
                  
                  <button
                    onClick={() => deleteChangelog(changelog.id)}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChangelogBuilder;