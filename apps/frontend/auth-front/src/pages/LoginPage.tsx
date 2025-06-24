import React, { useEffect, useState } from 'react';
import { initializeGoogleSignIn } from '../authFlow';

const LoginPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [initializationAttempted, setInitializationAttempted] = useState(false);

  const initializeAuth = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const redirectUri = new URLSearchParams(window.location.search).get('redirect_uri') || 'http://localhost:3000';
    
    if (!clientId) {
      setError('Google Client ID is not configured. Please check your environment variables.');
      return;
    }

    console.log('Initializing Google Sign-In...');
    setError(null);
    setInitializationAttempted(true);

    try {
      initializeGoogleSignIn(clientId, redirectUri);
    } catch (err) {
      console.error('Error initializing Google Sign-In:', err);
      setError('Failed to initialize Google Sign-In: ' + (err as Error).message);
    }
  };
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
        console.log('No existing auth found:', err);
      }      // Initialize Google Sign-In if not authenticated
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      const redirectUri = new URLSearchParams(window.location.search).get('redirect_uri') || 'http://localhost:3000';
      
      console.log('Environment check:');
      console.log('- Client ID:', clientId ? `${clientId.substring(0, 10)}...` : 'MISSING');
      console.log('- Redirect URI:', redirectUri);
      console.log('- Auth Service URL:', import.meta.env.VITE_AUTH_SERVICE_URL);
      console.log('- Google script loaded:', !!window.google);
      console.log('- Document ready state:', document.readyState);
      
      if (!clientId) {
        setError('Google Client ID is not configured. Please check your environment variables.');
        setIsLoading(false);
        return;
      }

      console.log('Initializing Google Sign-In...');
      setIsLoading(false); // Show the button container immediately
      setInitializationAttempted(true);

      // Initialize Google Sign-In with multiple attempts
      try {
        initializeGoogleSignIn(clientId, redirectUri);
      } catch (err) {
        console.error('Error initializing Google Sign-In:', err);
        setError('Failed to initialize Google Sign-In: ' + (err as Error).message);
      }
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
          </div>        ) : (
          <div>
            {isLoading ? (
              <div style={{ color: '#666', padding: '2rem' }}>
                <div>Loading Google Sign-In...</div>
                <div style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                  Please wait while we initialize the authentication system.
                </div>
              </div>            ) : (
              <div>
                <div 
                  id="google-signin-button" 
                  style={{ 
                    marginTop: '1rem', 
                    minHeight: '50px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    border: '1px dashed #ddd',
                    borderRadius: '4px',
                    padding: '1rem',
                    backgroundColor: '#fafafa'
                  }}
                >
                  {initializationAttempted ? (
                    <div style={{ 
                      color: '#666', 
                      fontSize: '0.9rem',
                      textAlign: 'center'
                    }}>
                      <div style={{ marginBottom: '0.5rem' }}>⏳ Loading Google Sign-In...</div>
                      <div style={{ fontSize: '0.8rem' }}>
                        If the button doesn't appear, try refreshing the page.
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: '#666', fontSize: '0.9rem' }}>
                      Preparing authentication...
                    </div>
                  )}
                </div>
                
                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                  <button 
                    onClick={initializeAuth}
                    style={{
                      backgroundColor: '#f5f5f5',
                      color: '#666',
                      border: '1px solid #ddd',
                      padding: '0.5rem 1rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      marginRight: '0.5rem'
                    }}
                  >
                    Retry Google Sign-In
                  </button>
                  <button 
                    onClick={() => window.location.reload()}
                    style={{
                      backgroundColor: '#f5f5f5',
                      color: '#666',
                      border: '1px solid #ddd',
                      padding: '0.5rem 1rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    Refresh Page
                  </button>
                </div>
                
                {error && (
                  <div style={{ 
                    marginTop: '1rem',
                    padding: '0.5rem',
                    backgroundColor: '#ffebee',
                    color: '#d32f2f',
                    borderRadius: '4px',
                    fontSize: '0.9rem'
                  }}>
                    Error: {error}
                    <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: '#666' }}>
                      Check browser console for detailed logs
                    </div>
                  </div>
                )}
              </div>
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
