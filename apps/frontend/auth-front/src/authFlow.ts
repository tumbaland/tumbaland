import { getGlobalConfig } from './config/ConfigProvider';
import { logger } from '@tumbaland/frontend-core';
import { authApi } from './services/authApi';

interface GoogleAccountsId {
  initialize(config: { client_id: string; callback: (response: { credential: string }) => void }): void;
  renderButton(parent: HTMLElement, options: { theme: string; size: string }): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
    googleScriptLoaded?: boolean;
  }
}

interface ValidateResponse {
  success: boolean;
  message?: string;
}

function handleCredentialResponse(response: { credential: string }, redirectUri: string) {
  const idToken = response.credential;

  logger.debug('Sending token to auth service', { authServiceUrl: getGlobalConfig().AUTH_SERVICE_URL });

  authApi
    .post<ValidateResponse>('/auth/validate', { idToken })
    .then((data) => {
      logger.debug('Auth service response', { success: data.success, message: data.message });
      if (data.success) {
        window.location.href = redirectUri; // Redirect back without JWT
      } else {
        logger.error('Validation failed', data.message);
        alert('Authentication failed: ' + (data.message || 'Unknown error'));
      }
    })
    .catch((err) => {
      logger.error('Google credential exchange failed', err);
      alert('Authentication error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    });
}

export function initializeGoogleSignIn(clientId: string, redirectUri: string) {
  logger.debug('Starting Google Sign-In initialization', { clientId, redirectUri });

  let retryCount = 0;
  const maxRetries = 100; // Wait up to 10 seconds
  let googleInitialized = false;
  const renderGoogleButton = () => {
    const buttonElement = document.getElementById('google-signin-button');
    if (!buttonElement) {
      return false;
    }

    // Check if Google button is already rendered (look for Google's button class)
    if (
      buttonElement.querySelector('[data-testid="google-signin-button"]') ||
      buttonElement.querySelector('div[role="button"]') ||
      buttonElement.innerHTML.includes('Sign in with Google')
    ) {
      return true;
    }

    const googleId = window.google?.accounts?.id;
    if (!googleId) {
      return false;
    }

    try {
      // Clear any existing content first
      buttonElement.innerHTML = '';

      googleId.renderButton(buttonElement, { theme: 'outline', size: 'large' });
      logger.debug('Google Sign-In button rendered successfully');
      return true;
    } catch (error) {
      logger.error('Error rendering Google Sign-In button', error);
      return false;
    }
  };
  const initializeGoogle = () => {
    retryCount++;

    // Check if Google Sign-In library is loaded
    if (!window.google || !window.google.accounts || !window.google.accounts.id) {
      if (retryCount < maxRetries) {
        setTimeout(initializeGoogle, 100);
        return;
      } else {
        logger.error('Google Sign-In library failed to load after maximum retries', undefined, {
          googleScriptLoaded: window.googleScriptLoaded
        });
        showFallbackMessage();
        return;
      }
    }

    // Initialize Google Sign-In if not already done
    if (!googleInitialized) {
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: { credential: string }) => handleCredentialResponse(response, redirectUri)
        });
        logger.debug('Google Sign-In initialized', { attempts: retryCount });
        googleInitialized = true;
      } catch (error) {
        logger.error('Error during Google Sign-In initialization', error);
        showFallbackMessage();
        return;
      }
    }

    // Try to render the button
    const buttonRendered = renderGoogleButton();

    if (!buttonRendered && retryCount < maxRetries) {
      setTimeout(initializeGoogle, 100);
    } else if (!buttonRendered) {
      logger.error('Failed to render Google Sign-In button after maximum retries');
      showFallbackMessage();
    }
  };

  const showFallbackMessage = () => {
    const buttonElement = document.getElementById('google-signin-button');
    if (buttonElement && !buttonElement.hasChildNodes()) {
      buttonElement.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #d32f2f; border: 1px solid #ddd; border-radius: 4px;">
          <p style="margin: 0 0 10px 0;">⚠️ Google Sign-In failed to load</p>
          <p style="margin: 0 0 15px 0; font-size: 0.9rem; color: #666;">
            This might be due to network issues or browser extensions blocking Google services.
          </p>
          <button onclick="window.location.reload()" style="padding: 10px 20px; background: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">
            Reload Page
          </button>
          <button onclick="window.open('${redirectUri}', '_self')" style="padding: 10px 20px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Skip Login
          </button>
        </div>
      `;
    }
  };

  // Use multiple strategies to ensure initialization happens

  // Strategy 1: Start immediately
  setTimeout(initializeGoogle, 0);

  // Strategy 2: Wait for DOM to be fully ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initializeGoogle, 100);
    });
  } else {
    setTimeout(initializeGoogle, 100);
  }

  // Strategy 3: Wait a bit longer in case of slow loading
  setTimeout(initializeGoogle, 500);
  setTimeout(initializeGoogle, 1000);
}
