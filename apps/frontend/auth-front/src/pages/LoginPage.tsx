import React, { useEffect, useState } from 'react';
import { Box, Card, CardContent, Alert } from '@mui/material';
import { initializeGoogleSignIn } from '../authFlow';
import LoggedInUser from '../components/LoggedInUser';
import LoginPrompt from '../components/LoginPrompt';
import { EnterSignInCode, ShowSignInCode } from '../components/SignInCode';
import { claimSignIn, forgetSignIn, startedSignIn } from '../signInHandoff';
import { useConfig } from '../config/ConfigProvider';
import { logger } from '@tumbaland/frontend-core';
import { authApi } from '../services/authApi';

/** How often the app asks whether a sign-in finished in another window. */
const CLAIM_POLL_MS = 4000;

/** The code auth-service's callback puts in the URL when it parked a sign-in. */
const parkedSignInCode = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  return params.get('signin') === 'pending' ? params.get('code') : null;
};

interface AuthenticatedUser {
  name: string;
  email: string;
  picture?: string;
}

/** Set by auth-service's /auth/google/callback when it could not sign the person in. */
const initialError = (): string | null =>
  new URLSearchParams(window.location.search).get('error') === 'signin_failed'
    ? 'Sign-in did not go through. Please try again.'
    : null;

const LoginPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(initialError);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [initializationAttempted, setInitializationAttempted] = useState(false);
  const [codeToShow, setCodeToShow] = useState<string | null>(null);
  const [askForCode, setAskForCode] = useState(false);
  const [submittingCode, setSubmittingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const config = useConfig();

  const finishSignIn = (redirect: string) => {
    forgetSignIn();
    window.location.href = redirect;
  };

  useEffect(() => {
    const checkExistingAuth = async () => {
      // Back from Google with a parked sign-in. If this is the window that
      // started it, collect it now; otherwise this is the Safari sheet, and the
      // person needs the code to finish in the app.
      const parkedCode = parkedSignInCode();
      if (parkedCode) {
        const started = startedSignIn();
        if (started) {
          try {
            if ((await claimSignIn(started.nonce, parkedCode)) === 'signed_in') {
              finishSignIn(started.redirect);
              return;
            }
          } catch (err) {
            logger.warn('Could not collect the parked sign-in here', { error: err });
          }
        }
        setCodeToShow(parkedCode);
        setIsLoading(false);
        return;
      }

      try {
        const data = await authApi.get<{ success: boolean; authenticated: boolean; user?: unknown }>('/auth/verify');
        if (data.success && data.authenticated) {
          forgetSignIn();
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
    checkExistingAuth();
  }, [config]);

  // While a sign-in started here may be waiting in another window, ask about it
  // whenever this page is in view: when the Safari sheet closes, and every few
  // seconds while it stays open.
  useEffect(() => {
    if (askForCode || codeToShow || user) return;

    let stopped = false;
    const check = async () => {
      const started = startedSignIn();
      if (stopped || !started || document.visibilityState !== 'visible') return;
      try {
        if ((await claimSignIn(started.nonce)) === 'code_required' && !stopped) {
          setAskForCode(true);
        }
      } catch (err) {
        logger.debug('Pending sign-in check failed', { error: err });
      }
    };

    check();
    const interval = window.setInterval(check, CLAIM_POLL_MS);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, [askForCode, codeToShow, user]);

  const handleCode = async (code: string) => {
    const started = startedSignIn();
    if (!started) {
      setAskForCode(false);
      setError('That sign-in has expired. Please sign in again.');
      return;
    }
    setSubmittingCode(true);
    setCodeError(null);
    try {
      const status = await claimSignIn(started.nonce, code);
      if (status === 'signed_in') {
        finishSignIn(started.redirect);
        return;
      }
      forgetSignIn();
      setAskForCode(false);
      setError('That sign-in has expired. Please sign in again.');
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : 'Sign-in did not go through. Please try again.');
    } finally {
      setSubmittingCode(false);
    }
  };

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
          p: { xs: 4, sm: 6 },
          borderRadius: 6,
          boxShadow: '0 20px 60px -10px rgba(31, 38, 135, 0.25)',
          minWidth: 340,
          maxWidth: 420,
          width: '100%',
          textAlign: 'center',
          background: 'rgba(255, 255, 255, 0.75)',
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
          {codeToShow ? (
            <ShowSignInCode code={codeToShow} />
          ) : askForCode ? (
            <EnterSignInCode onSubmit={handleCode} submitting={submittingCode} error={codeError} />
          ) : user ? (
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
