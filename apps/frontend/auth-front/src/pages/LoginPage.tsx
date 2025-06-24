import React, { useEffect, useState } from 'react';
import { initializeGoogleSignIn } from '../authFlow';

const LoginPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkExistingAuth = async () => {
      try {
        const authServiceUrl = import.meta.env.VITE_AUTH_SERVICE_URL || 'http://localhost:5001';
        const response = await fetch(`${authServiceUrl}/auth/verify`, {
          credentials: 'include'
        });
        const data = await response.json();
        
        if (data.success && data.authenticated) {
          setUser(data.user);
          setIsLoading(false);
          return;
        }
      } catch (err) {
        console.log('No existing auth found');
      }

      // Initialize Google Sign-In if not authenticated
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      const redirectUri = new URLSearchParams(window.location.search).get('redirect_uri') || 'http://localhost:3000';
      
      if (!clientId) {
        setError('Google Client ID is not configured');
        setIsLoading(false);
        return;
      }

      console.log('Initializing Google Sign-In with Client ID:', clientId);
      console.log('Redirect URI:', redirectUri);

      // Wait a bit for the Google script to load
      setTimeout(() => {
        try {
          initializeGoogleSignIn(clientId, redirectUri);
          setIsLoading(false);
        } catch (err) {
          console.error('Error initializing Google Sign-In:', err);
          setError('Failed to initialize Google Sign-In');
          setIsLoading(false);
        }
      }, 500);
    };

    checkExistingAuth();
  }, []);

  const handleLogout = async () => {
    try {
      const authServiceUrl = import.meta.env.VITE_AUTH_SERVICE_URL || 'http://localhost:5001';
      const response = await fetch(`${authServiceUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        setUser(null);
        window.location.reload(); // Reload to reinitialize login
      }
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const handleContinue = () => {
    const redirectUri = new URLSearchParams(window.location.search).get('redirect_uri') || 'http://localhost:3000';
    window.location.href = redirectUri;
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh',
      fontFamily: 'Roboto, sans-serif',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        textAlign: 'center',
        minWidth: '300px'
      }}>
        <h1 style={{ marginBottom: '2rem', color: '#333' }}>Welcome to Tumbaland</h1>
        
        {error && (
          <div style={{ 
            color: 'red', 
            marginBottom: '1rem',
            padding: '0.5rem',
            backgroundColor: '#ffebee',
            borderRadius: '4px'
          }}>
            {error}
          </div>
        )}

        {user ? (
          <div>
            <div style={{ marginBottom: '2rem' }}>
              {user.picture && (
                <img 
                  src={user.picture} 
                  alt="Profile" 
                  style={{ 
                    width: '60px', 
                    height: '60px', 
                    borderRadius: '50%', 
                    marginBottom: '1rem' 
                  }} 
                />
              )}
              <h3 style={{ margin: '0.5rem 0', color: '#333' }}>Welcome back, {user.name}!</h3>
              <p style={{ color: '#666', fontSize: '0.9rem' }}>{user.email}</p>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                onClick={handleContinue}
                style={{
                  backgroundColor: '#4285f4',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
              >
                Continue
              </button>
              <button 
                onClick={handleLogout}
                style={{
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
              >
                Logout
              </button>
            </div>
          </div>
        ) : (
          <div>
            {isLoading ? (
              <div style={{ color: '#666' }}>Loading...</div>
            ) : (
              <div id="google-signin-button" style={{ marginTop: '1rem' }}></div>
            )}
            
            <p style={{ 
              marginTop: '1rem', 
              fontSize: '0.9rem', 
              color: '#666' 
            }}>
              Sign in with your Google account to continue
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
