declare global {
  interface Window {
    google: any;
  }
}

function handleCredentialResponse(response: { credential: string }, redirectUri: string) {
  const idToken = response.credential;
  const authServiceUrl = import.meta.env.VITE_AUTH_SERVICE_URL || 'http://localhost:5001';

  console.log('Sending token to auth service:', authServiceUrl);

  fetch(`${authServiceUrl}/auth/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
    credentials: 'include', // Include cookies in the request
  })
    .then((res) => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    })
    .then((data) => {
      console.log('Auth service response:', data);
      if (data.success) {
        window.location.href = redirectUri; // Redirect back without JWT
      } else {
        console.error('Validation failed:', data.message);
        alert('Authentication failed: ' + (data.message || 'Unknown error'));
      }
    })
    .catch((err) => {
      console.error('Error:', err);
      alert('Authentication error: ' + err.message);
    });
}

export function initializeGoogleSignIn(clientId: string, redirectUri: string) {
  const initializeGoogle = () => {
    if (window.google && window.google.accounts) {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: { credential: string }) => handleCredentialResponse(response, redirectUri),
      });
      
      const buttonElement = document.getElementById('google-signin-button');
      if (buttonElement) {
        window.google.accounts.id.renderButton(
          buttonElement,
          { theme: 'outline', size: 'large' }
        );
      }
    } else {
      // Retry after a short delay if Google Sign-In hasn't loaded yet
      setTimeout(initializeGoogle, 100);
    }
  };

  // Start initialization immediately
  initializeGoogle();
}
