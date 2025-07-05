import React from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline } from '@mui/material';
import App from './App';
import { authService } from './services/authService';
import { loadRuntimeConfig } from './config/runtime';

// Initialize runtime configuration and auth service
async function initializeApp() {
  await loadRuntimeConfig();
  authService.init();
  
  const element = document.getElementById('album-root');
  if (element) {
    ReactDOM.createRoot(element).render(
      <React.StrictMode>
        <CssBaseline />
        <App />
      </React.StrictMode>
    );
  }
}

// Initialize the app
initializeApp();
