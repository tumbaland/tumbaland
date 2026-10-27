import React, { useEffect, useState } from 'react';
import { Box, Card, CardContent, Alert } from '@mui/material';
import { initializeGoogleSignIn } from '../authFlow';
import LoggedInUser from '../components/LoggedInUser';
import LoginPrompt from '../components/LoginPrompt';
import { useConfig } from '../config/ConfigProvider';
import { logger } from '@tumbaland/frontend-core';
import { authApi } from '../services/authApi';

interface AuthenticatedUser {
  name: string;
  email: string;
  picture?: string;
}

/**
 * Set by auth-service's /auth/google/callback when it could not sign the person
 * in: `account_closed` when an administrator closed their account at their
 * request, `signin_failed` for anything else.
 */
const initialError = (): string | null => {
  const error = new URLSearchParams(window.location.search).get('error');
  if (error === 'account_closed') {
    return 'This account was closed at your request. Write to us if this is a mistake.';
  }
  return error === 'signin_failed' ? 'Sign-in did not go through. Please try again.' : null;
};

const LoginPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(initialError);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [initializationAttempted, setInitializationAttempted] = useState(false);
  const config = useConfig();

  useEffect(() => {
    const checkExistingAuth = async () => {
      try {
        const data = await authApi.get<{ success: boolean; authenticated: boolean; user?: unknown }>('/auth/verify');
        if (data.success && data.authenticated) {
          setUser(data.user as AuthenticatedUser);
          setIsLoading(false);
          return;
        }
      } catch (err) {
        logger.debug('No existing auth found', { error: err });
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
        logger.error('Error initializing Google Sign-In', err);
        setError('Failed to initialize Google Sign-In: ' + (err as Error).message);
      }
    };
    void checkExistingAuth();
  }, [config]);

  const handleLogout = async () => {
    try {
      await authApi.post('/auth/logout');
      setUser(null);
      window.location.reload();
    } catch (err) {
      logger.error('Logout failed', err);
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
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, Roboto, sans-serif',
        py: 4
      }}
    >
      <Box
        sx={{
          mb: 4,
          textAlign: 'center',
          fontFamily: '"Pacifico", cursive',
          fontSize: { xs: 36, sm: 48 },
          background: 'linear-gradient(135deg, #ff1fae 0%, #8b5cf6 100%)',
          backgroundClip: 'text',
          textFillColor: 'transparent',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
          // Add padding to prevent the cursive font from being clipped
          p: 2
        }}
      >
        Tumbaland
      </Box>

      <Card
        sx={{
          p: { xs: 3, sm: 6 },
          borderRadius: 6,
          boxShadow: '0 20px 60px -10px rgba(31, 38, 135, 0.25)',
          // No minWidth: 340 plus 32px of padding a side needed 404px, which a
          // 360px phone does not have, so the card pushed the page sideways.
          maxWidth: 420,
          width: '100%',
          textAlign: 'center',
          background: 'color-mix(in srgb, var(--mui-palette-background-paper) 75%, transparent)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.8)',
          transition: 'transform 0.3s ease, box-shadow 0.3s ease',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 25px 70px -10px rgba(31, 38, 135, 0.3)'
          }
        }}
      >
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
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
