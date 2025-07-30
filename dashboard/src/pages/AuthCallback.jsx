import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AuthCallback = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the authorization code from URL
        const urlParams = new URLSearchParams(location.search);
        const code = urlParams.get('code');

        if (!code) {
          throw new Error('No authorization code found');
        }

        console.log('Received auth code:', code.substring(0, 5) + '...');

        // Exchange code for token
        const success = await login(code);
        
        if (success) {
          // Redirect to dashboard on success
          navigate('/dashboard');
        } else {
          throw new Error('Login failed');
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setError(err.message || 'Authentication failed');
      } finally {
        setLoading(false);
      }
    };

    handleCallback();
  }, [location.search, login, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-white">Authenticating...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="bg-red-600 text-white p-4 rounded-lg">
            <h2 className="text-xl font-bold mb-2">Authentication Error</h2>
            <p>{error}</p>
            <p className="mt-4 text-sm">Try logging in again with a fresh authorization code.</p>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="mt-6 bg-slate-700 hover:bg-slate-600 text-white py-2 px-4 rounded"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-white">Redirecting to dashboard...</p>
      </div>
    </div>
  );
};

export default AuthCallback; 