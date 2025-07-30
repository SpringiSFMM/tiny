import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { format, formatDistanceToNow, parseISO, isAfter, isBefore, isToday } from 'date-fns';
import axios from 'axios';
import { io } from 'socket.io-client';
import './LoaManager.css'; // Importiere die benutzerdefinierten CSS-Stile

// Icon components
const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="icon-standard" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="icon-small" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

const FilterIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="icon-standard" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
  </svg>
);

// Ausrufzeichen-Icon für Warnungen und Hinweise

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="icon-small" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="icon-small" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="icon-small" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="icon-standard" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const LoadingSpinner = () => (
  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const AlertIcon = ({ type } = {}) => {
  // Wenn ein Typ angegeben ist, verwenden wir das Info-Icon mit verschiedenen Farben
  if (type) {
    const colors = {
      success: "text-accent-400",
      error: "text-error-400",
      warning: "text-warning-400",
      info: "text-primary-400",
    };
    
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${colors[type] || colors.info}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  
  // Standardmäßig verwenden wir das Warndreieck-Icon
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="icon-standard" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
};

// Badge component for statuses
const StatusBadge = ({ status }) => {
  let badgeClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ";
  let shadowClass = "";
  let animationClass = "";
  
  switch (status) {
    case 'active':
      badgeClasses += "bg-primary-700/50 text-primary-300 border border-primary-700";
      shadowClass = "shadow-primary-glow";
      animationClass = "animate-gentle-pulse";
      break;
    case 'pending':
      badgeClasses += "bg-warning-700/50 text-warning-300 border border-warning-700";
      shadowClass = "shadow-warning-glow";
      break;
    case 'approved':
      badgeClasses += "bg-accent-700/50 text-accent-300 border border-accent-700";
      shadowClass = "shadow-accent-glow";
      break;
    case 'denied':
      badgeClasses += "bg-error-700/50 text-error-300 border border-error-700";
      shadowClass = "shadow-error-glow";
      break;
    default:
      badgeClasses += "bg-surface-700 text-surface-300 border border-surface-600";
  }
  
  return (
    <span className={`${badgeClasses} ${shadowClass} ${animationClass}`}>
      {status === 'active' && <span className="w-2 h-2 rounded-full bg-primary-400 mr-1.5 inline-block"></span>}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

const LoaManager = () => {
  const { getAuthHeader, user } = useAuth();
  const [loas, setLoas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newLoa, setNewLoa] = useState({
    startDate: '',
    endDate: '',
    reason: '',
    type: 'personal',
    contact: '',
    isPrivate: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [filter, setFilter] = useState('all'); // all, active, pending, approved, denied
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef(null);
  
  // Staff roles with LOA management permissions
  const staffLoaRoleIds = [
    "1307038459915141263",
    "1308042640926707733",
    "1307038465468403764",
    "1370725982318891048"
  ];

  // Check if user has LOA management permissions
  const hasLoaManagementPermission = () => {
    // If user is admin, they have all permissions
    if (user?.isAdmin) return true;
    
    // Check if user has any of the specified roles
    return user?.roles?.some(role => staffLoaRoleIds.includes(role.id));
  };

  // Connect to Socket.IO for real-time updates
  useEffect(() => {
    const token = localStorage.getItem('token');
    
    // Socket.IO connection
    if (token && !socketRef.current) {
      // Connect to socket.io server with auth token
      socketRef.current = io('http://localhost:3001', {
        auth: { token }
      });
      
      socketRef.current.on('connect', () => {
        console.log('Connected to socket.io server for LOA updates');
        setSocketConnected(true);
      });
      
      socketRef.current.on('loa_update', (data) => {
        console.log('Received LOA update:', data);
        
        if (data.action === 'approve' || data.action === 'deny') {
          setLoas(prev => prev.map(loa => {
            if (loa.id === data.loaId) {
              // Update the status and create a success notification
              setSuccessMessage(
                `LOA ${data.loaId} was ${data.action === 'approve' ? 'approved' : 'denied'} by ${data.updatedBy}`
              );
              
              // Clear success message after 5 seconds
              setTimeout(() => setSuccessMessage(''), 5000);
              
              return { 
                ...loa, 
                approved: data.action === 'approve', 
                denied: data.action === 'deny',
                status: data.action === 'approve' ? 'approved' : 'denied'
              };
            }
            return loa;
          }));
        } else if (data.action === 'delete') {
          setLoas(prev => prev.filter(loa => loa.id !== data.loaId));
        }
      });
      
      socketRef.current.on('disconnect', () => {
        console.log('Disconnected from socket.io server');
        setSocketConnected(false);
      });
      
      socketRef.current.on('connect_error', (error) => {
        console.error('Socket connection error:', error.message);
        setSocketConnected(false);
      });
      
      // Clean up function
      return () => {
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
      };
    }
  }, []);
  
  // Load LOAs
  useEffect(() => {
    const fetchLoas = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setErrorMessage('');
        const token = localStorage.getItem('token');
        
        const response = await axios.get('http://localhost:3001/api/loa', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        // Add status field to each LOA for easier filtering
        const loasWithStatus = response.data.map(loa => {
          let status = 'pending';
          
          if (loa.approved) status = 'approved';
          else if (loa.denied) status = 'denied';
          else {
            // Check if LOA is active (current date is between start and end)
            const now = new Date();
            const start = new Date(loa.startDate);
            const end = new Date(loa.endDate);
            
            if (now >= start && now <= end) {
              status = 'active';
            } else if (now > end) {
              status = 'expired';
            }
          }
          
          return { ...loa, status };
        });
        
        setLoas(loasWithStatus);
      } catch (err) {
        console.error('Error fetching LOAs:', err);
        setError('Failed to load LOAs. Please try again later.');
        setErrorMessage('There was an error loading your LOA requests. Please refresh the page.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchLoas();
  }, [getAuthHeader]);
  
  // Filter LOAs based on selected filter
  const filteredLoas = () => {
    if (filter === 'all') return loas;
    return loas.filter(loa => loa.status === filter);
  };
  
  // Format date in a more readable way
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Calculate time elapsed since creation
  const getTimeAgo = (dateString) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (e) {
      return "Unknown date";
    }
  };

  // Validate form input
  const validateForm = () => {
    if (!newLoa.startDate) return "Start date is required";
    if (!newLoa.endDate) return "End date is required";
    if (!newLoa.reason) return "Reason is required";
    if (new Date(newLoa.startDate) > new Date(newLoa.endDate)) {
      return "Start date cannot be after end date";
    }
    return null; // No validation errors
  };
  
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNewLoa(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear any previous error when typing
    setErrorMessage('');
  };
  
  const handleLoaSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form input
    const validationError = validateForm();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }
    
    try {
      setIsSubmitting(true);
      setErrorMessage('');
      const token = localStorage.getItem('token');
      
      const response = await axios.post('http://localhost:3001/api/loa', newLoa, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Add status field to the new LOA
      const now = new Date();
      const start = new Date(response.data.startDate);
      const end = new Date(response.data.endDate);
      let status = 'pending';
      
      if (now >= start && now <= end) {
        status = 'active';
      }
      
      // Update LOA list with the new LOA
      const newLoaWithStatus = { ...response.data, status };
      setLoas(prev => [newLoaWithStatus, ...prev]);
      setSuccessMessage('LOA request submitted successfully!');
      
      // Reset form
      setNewLoa({
        startDate: '',
        endDate: '',
        reason: '',
        type: 'personal',
        contact: '',
        isPrivate: false
      });
      setShowCreateForm(false);
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error('Error creating LOA:', err);
      setErrorMessage(err.response?.data?.message || 'Failed to submit LOA request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleLoaAction = async (loaId, action) => {
    if (!hasLoaManagementPermission() && (action === 'approve' || action === 'deny')) {
      setErrorMessage('You do not have permission to manage LOA requests');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:3001/api/loa/${loaId}/${action}`, {}, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Update the LOA list based on action
      if (action === 'approve' || action === 'deny') {
        setLoas(prev => prev.map(loa => {
          if (loa.id === loaId) {
            return { 
              ...loa, 
              approved: action === 'approve', 
              denied: action === 'deny',
              status: action === 'approve' ? 'approved' : 'denied'
            };
          }
          return loa;
        }));
      } else if (action === 'delete') {
        setLoas(prev => prev.filter(loa => loa.id !== loaId));
      }
      
      setSuccessMessage(`LOA ${action === 'approve' ? 'approved' : action === 'deny' ? 'denied' : 'deleted'} successfully!`);
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error(`Error ${action} LOA:`, err);
      setErrorMessage(err.response?.data?.message || `Failed to ${action} LOA. Please try again.`);
    }
  };
  
  // Check permissions
  const isAdmin = user?.isAdmin;
  const canManageLoas = hasLoaManagementPermission();
  
  return (
    <div className="space-y-8">
      {/* Header with title and create button */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CalendarIcon /> 
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-300 to-accent-300">
              LOA Manager
            </span>
          </h1>
          <p className="text-surface-300 mt-1">Manage leave of absence requests for staff members</p>
        </div>
        
        <button 
          onClick={() => setShowCreateForm(!showCreateForm)}
          className={`btn ${showCreateForm ? 'btn-outline' : 'btn-primary'} flex items-center gap-2`}
        >
          {showCreateForm ? (
            <>
              <CloseIcon />
              Cancel
            </>
          ) : (
            <>
              <PlusIcon />
              New LOA Request
            </>
          )}
        </button>
      </div>
      
      {/* Notification messages */}
      {errorMessage && (
        <div key="error-notification" className="bg-error-700/30 text-error-300 border border-error-700/50 rounded-lg p-4 mb-4 flex items-center gap-3 shadow-error-glow card-glass animate-fadeIn">
          <div className="p-1.5 bg-error-900/50 rounded-full">
            <AlertIcon />
          </div>
          <span className="font-medium">{errorMessage}</span>
          <button 
            onClick={() => setErrorMessage('')} 
            className="ml-auto text-error-300 hover:text-error-200 p-1.5 rounded-full hover:bg-error-800/50 transition-colors"
            aria-label="Dismiss error message"
          >
            <CloseIcon />
          </button>
        </div>
      )}
      
      {successMessage && (
        <div key="success-notification" className="bg-accent-700/30 text-accent-300 border border-accent-700/50 rounded-lg p-4 mb-4 flex items-center gap-3 shadow-accent-glow card-glass animate-fadeIn">
          <div className="p-1.5 bg-accent-900/50 rounded-full">
            <CheckIcon />
          </div>
          <span className="font-medium">{successMessage}</span>
          <button 
            onClick={() => setSuccessMessage('')} 
            className="ml-auto text-accent-300 hover:text-accent-200 p-1.5 rounded-full hover:bg-accent-800/50 transition-colors"
            aria-label="Dismiss success message"
          >
            <CloseIcon />
          </button>
        </div>
      )}
      
      {/* LOA Create Form */}
      {showCreateForm && (
        <div className="card card-glass p-5 mb-6 border-t-2 border-primary-500">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <PlusIcon />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-300 to-accent-300">
              Create New LOA Request
            </span>
          </h2>
          
          <form onSubmit={handleLoaSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 form-grid">
              <div>
                <label className="form-label">Start Date:</label>
                <div className="relative">
                  <input 
                    type="date" 
                    name="startDate" 
                    value={newLoa.startDate} 
                    onChange={handleInputChange}
                    className="form-input pl-9"
                    required
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400">
                    <CalendarIcon />
                  </div>
                </div>
              </div>
              <div>
                <label className="form-label">End Date:</label>
                <div className="relative">
                  <input 
                    type="date" 
                    name="endDate" 
                    value={newLoa.endDate} 
                    onChange={handleInputChange}
                    className="form-input pl-9"
                    required
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400">
                    <CalendarIcon />
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <label className="form-label">Reason:</label>
              <textarea 
                name="reason" 
                value={newLoa.reason} 
                onChange={handleInputChange}
                className="form-input min-h-[120px] resize-y"
                required
                placeholder="Please provide details about your leave of absence..."
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="form-label">Type:</label>
                <select 
                  name="type" 
                  value={newLoa.type} 
                  onChange={handleInputChange}
                  className="form-input"
                  required
                >
                  <option value="">Select type</option>
                  <option value="vacation">Vacation</option>
                  <option value="personal">Personal</option>
                  <option value="medical">Medical</option>
                  <option value="educational">Educational</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="form-label">Contact Info (optional):</label>
                <input 
                  type="text" 
                  name="contact" 
                  value={newLoa.contact} 
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="How to reach you during LOA (if needed)"
                />
              </div>
            </div>
            
            <div className="flex items-center bg-surface-800/50 p-3 rounded-lg border border-surface-700/30">
              <input 
                type="checkbox" 
                id="isPrivate" 
                name="isPrivate" 
                checked={newLoa.isPrivate} 
                onChange={(e) => setNewLoa({...newLoa, isPrivate: e.target.checked})}
                className="form-checkbox"
              />
              <label htmlFor="isPrivate" className="ml-2 text-surface-300 flex items-center gap-1">
                <LockIcon />
                Make this LOA private (reason visible only to admins and LOA managers)
              </label>
            </div>
            
            <div className="flex justify-end gap-3 mt-5">
              <button 
                type="button" 
                onClick={() => setShowCreateForm(false)}
                className="btn btn-outline"
              >
                <CloseIcon />
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <LoadingSpinner />
                    Submitting...
                  </>
                ) : (
                  <>
                    <PlusIcon />
                    Submit Request
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
      
      {/* Filter tabs */}
      <div className="card card-glass p-4">
        <div className="flex items-center gap-2 mb-3 text-surface-200">
          <FilterIcon />
          <h3 className="font-semibold">Filter LOA Requests</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${filter === 'all' 
              ? 'bg-surface-600 text-white shadow-md' 
              : 'bg-surface-800/60 text-surface-400 hover:text-white hover:bg-surface-700/60'}`}
            onClick={() => setFilter('all')}
          >
            All Requests
          </button>
          <button 
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${filter === 'active' 
              ? 'bg-primary-600/30 text-primary-300 shadow-primary-glow' 
              : 'bg-surface-800/60 text-surface-400 hover:text-primary-300 hover:bg-primary-900/20'}`}
            onClick={() => setFilter('active')}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary-400 animate-gentle-pulse"></span>
              Active
            </div>
          </button>
          <button 
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${filter === 'pending' 
              ? 'bg-warning-600/30 text-warning-300 shadow-warning-glow' 
              : 'bg-surface-800/60 text-surface-400 hover:text-warning-300 hover:bg-warning-900/20'}`}
            onClick={() => setFilter('pending')}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-warning-400"></span>
              Pending
            </div>
          </button>
          <button 
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${filter === 'approved' 
              ? 'bg-accent-600/30 text-accent-300 shadow-accent-glow' 
              : 'bg-surface-800/60 text-surface-400 hover:text-accent-300 hover:bg-accent-900/20'}`}
            onClick={() => setFilter('approved')}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent-400"></span>
              Approved
            </div>
          </button>
          <button 
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${filter === 'denied' 
              ? 'bg-error-600/30 text-error-300 shadow-error-glow' 
              : 'bg-surface-800/60 text-surface-400 hover:text-error-300 hover:bg-error-900/20'}`}
            onClick={() => setFilter('denied')}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-error-400"></span>
              Denied
            </div>
          </button>
        </div>
        
        {/* Statistik der LOAs - kann später implementiert werden */}
        <div className="mt-4 pt-3 border-t border-surface-700/50 grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-xs text-surface-400">
          <div>
            <div className="text-lg font-bold text-surface-100">{loas.filter(l => l.status === 'active').length}</div>
            <div>Active LOAs</div>
          </div>
          <div>
            <div className="text-lg font-bold text-surface-100">{loas.filter(l => l.status === 'pending').length}</div>
            <div>Pending Approval</div>
          </div>
          <div>
            <div className="text-lg font-bold text-surface-100">{loas.filter(l => l.status === 'approved').length}</div>
            <div>Approved Total</div>
          </div>
          <div>
            <div className="text-lg font-bold text-surface-100">{loas.filter(l => l.status === 'denied').length}</div>
            <div>Denied Requests</div>
          </div>
        </div>
      </div>
      
      {/* LOA List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="card flex justify-center items-center py-12">
            <svg className="animate-spin h-8 w-8 text-primary-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-surface-300 mt-4">Loading LOA requests...</p>
          </div>
        ) : filteredLoas().length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-full bg-surface-700/50 mb-4">
              <CalendarIcon />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              {filter === 'all' ? 'No LOA requests found' : `No ${filter} LOA requests found`}
            </h3>
            <p className="text-surface-400 max-w-md">
              {filter === 'all' 
                ? 'There are no leave of absence requests yet.'
                : `There are currently no ${filter} leave of absence requests.`}
            </p>
          </div>
        ) : (
          filteredLoas().map(loa => (
            <div 
              key={loa.id} 
              className="card card-glass card-hover border border-surface-700/50"
            >
              <div className="flex flex-col md:flex-row justify-between gap-4">
                {/* LOA Status Indicator (left border) */}
                <div className={`absolute top-0 bottom-0 left-0 w-1 rounded-l-lg ${loa.status === 'active' ? 'bg-primary-500 animate-gentle-pulse' : 
                  loa.status === 'approved' ? 'bg-accent-500' : 
                  loa.status === 'denied' ? 'bg-error-500' : 
                  loa.status === 'pending' ? 'bg-warning-500' : 
                  'bg-surface-500'}`}></div>
                  
                <div className="flex-grow">
                  {/* Header with username and badges */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <h3 className="text-lg font-semibold text-white flex items-center">
                      <span className="inline-block w-8 h-8 rounded-full bg-surface-600 text-white flex items-center justify-center mr-2 text-sm font-bold">
                        {(loa.username || user.username).charAt(0).toUpperCase()}
                      </span>
                      {loa.username || user.username}
                    </h3>
                    <div className="flex gap-2">
                      <StatusBadge status={loa.status} />
                      {loa.isPrivate && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-700 text-surface-300 border border-surface-600">
                          <LockIcon />
                          <span className="ml-1">Private</span>
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Date range with improved visual */}
                  <div className="flex items-center text-surface-300 text-sm mb-3 bg-surface-800/30 p-2 rounded">
                    <div className="p-1.5 rounded-full bg-surface-700/50 mr-2">
                      <CalendarIcon />
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium">
                        {formatDate(loa.startDate)}
                      </span>
                      <div className="mx-2 flex items-center">
                        <div className="h-px w-5 bg-surface-500"></div>
                        <div className="w-2 h-2 rounded-full bg-surface-500"></div>
                        <div className="h-px w-5 bg-surface-500"></div>
                      </div>
                      <span className="font-medium">
                        {formatDate(loa.endDate)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Reason with improved card style */}
                  <div className="bg-surface-800/50 rounded-lg p-3 my-3 border border-surface-700/30">
                    <h4 className="text-sm font-medium text-surface-200 mb-1 flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="icon-small" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                      Reason:
                    </h4>
                    <p className="text-surface-300 whitespace-pre-wrap">
                      {loa.isPrivate && !canManageLoas ? 
                        <span className="flex items-center gap-2 italic text-surface-400">
                          <LockIcon /> This reason is private and only visible to admins and authorized staff
                        </span> 
                        : loa.reason}
                    </p>
                  </div>
                  
                  {/* Additional details with improved styling */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                    <div className="flex flex-col p-2 bg-surface-800/30 rounded">
                      <span className="text-surface-400 text-xs">Type</span>
                      <span className="text-surface-200 font-medium capitalize">{loa.type}</span>
                    </div>
                    
                    {(!loa.isPrivate || canManageLoas) && loa.contact && (
                      <div className="flex flex-col p-2 bg-surface-800/30 rounded">
                        <span className="text-surface-400 text-xs">Contact</span>
                        <span className="text-surface-200 font-medium">{loa.contact}</span>
                      </div>
                    )}
                    
                    <div className="flex flex-col p-2 bg-surface-800/30 rounded">
                      <span className="text-surface-400 text-xs">Requested</span>
                      <span className="text-surface-200 font-medium" title={formatDate(loa.createdAt)}>
                        {getTimeAgo(loa.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Action buttons with improved styling */}
                <div className="flex flex-col md:items-end gap-2 border-t md:border-t-0 border-surface-700/50 pt-4 md:pt-0">
                  {/* Staff permissions check based on role IDs from memory */}
                  {canManageLoas && !loa.approved && !loa.denied && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleLoaAction(loa.id, 'approve')}
                        className="btn btn-sm btn-accent flex items-center gap-1 shadow-accent-glow"
                        title="Approve LOA Request"
                      >
                        <CheckIcon />
                        Approve
                      </button>
                      <button
                        onClick={() => handleLoaAction(loa.id, 'deny')}
                        className="btn btn-sm btn-error flex items-center gap-1 shadow-error-glow"
                        title="Deny LOA Request"
                      >
                        <CloseIcon />
                        Deny
                      </button>
                    </div>
                  )}
                  
                  {canManageLoas && (
                    <button
                      onClick={() => handleLoaAction(loa.id, 'delete')}
                      className="btn btn-sm btn-outline-error flex items-center gap-1 text-xs"
                      title="Delete LOA Request"
                    >
                      <TrashIcon />
                      Delete
                    </button>
                  )}
                  
                  {/* Status indicators for approved/denied requests */}
                  {loa.approved && (
                    <div className="flex items-center gap-1 text-accent-400 text-xs bg-accent-500/10 p-1 px-2 rounded">
                      <CheckIcon />
                      <span>Approved by staff</span>
                    </div>
                  )}
                  
                  {loa.denied && (
                    <div className="flex items-center gap-1 text-error-400 text-xs bg-error-500/10 p-1 px-2 rounded">
                      <CloseIcon />
                      <span>Denied by staff</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LoaManager;