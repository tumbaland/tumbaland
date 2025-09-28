import React, { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, Divider, Alert } from '@mui/material';
import { initializeGoogleSignIn } from '../authFlow';
import LoggedInUser from '../components/LoggedInUser';
import LoginPrompt from '../components/LoginPrompt';
import { useConfig } from '../config/useConfig';
import { getCorrelationId, getSessionId } from '@tumbaland/components';

const LoginPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [initializationAttempted, setInitializationAttempted] = useState(false);
  const config = useConfig();

  useEffect(() => {
    const checkExistingAuth = async () => {
      try {
        const response = await fetch(`${config.AUTH_SERVICE_URL}/auth/verify`, {
          credentials: 'include',
          headers: {
            'x-correlation-id': getCorrelationId(),
            'x-session-id': getSessionId()
          }
        });
        const data = await response.json();
        if (data.success && data.authenticated) {
          setUser(data.user);
          setIsLoading(false);
          return;
        }
      } catch (err) {
        console.log('No existing auth found:', err);
      }

      const redirectUri = new URLSearchParams(window.location.search).get('redirect_uri') || '/';

      if (!config.GOOGLE_CLIENT_ID) {
        setError('Google Client ID is not configured. Please check your environment variables.');
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      setInitializationAttempted(true);
      try {
        initializeGoogleSignIn(config.GOOGLE_CLIENT_ID, redirectUri);
      } catch (err) {
        console.error('Error initializing Google Sign-In:', err);
        setError('Failed to initialize Google Sign-In: ' + (err as Error).message);
      }
    };
    checkExistingAuth();
  }, [config]);

  const handleLogout = async () => {
    try {
      const response = await fetch(`${config.AUTH_SERVICE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'x-correlation-id': getCorrelationId(),
          'x-session-id': getSessionId()
        }
      });
      if (response.ok) {
        setUser(null);
        window.location.reload();
      }
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const handleContinue = () => {
    const redirectUri = new URLSearchParams(window.location.search).get('redirect_uri') || '/';
    window.location.href = redirectUri;
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)',
        fontFamily: 'Inter, Roboto, sans-serif'
      }}
    >
      <Card
        sx={{
          p: { xs: 3, sm: 5 },
          borderRadius: 5,
          boxShadow: 8,
          minWidth: 340,
          maxWidth: 380,
          width: '100%',
          textAlign: 'center',
          background: 'rgba(255,255,255,0.98)'
        }}
      >
        <CardContent>
          <Typography variant="h4" fontWeight={700} color="primary.dark" mb={2}>
            Tumbaland Login
          </Typography>
          <Divider sx={{ mb: 3, opacity: 0.15 }} />
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {user ? (
            <LoggedInUser user={user} onContinue={handleContinue} onLogout={handleLogout} />
          ) : (
            <LoginPrompt isLoading={isLoading} initializationAttempted={initializationAttempted} error={error} />
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default LoginPage;
