import React from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline } from '@mui/material';
import App from './App';

const element = document.getElementById('album-root');
if (element) {
  ReactDOM.createRoot(element).render(
    <React.StrictMode>
      <CssBaseline />
      <App />
    </React.StrictMode>
  );
}

// Export the App component
export { App };
