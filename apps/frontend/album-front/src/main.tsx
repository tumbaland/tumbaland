import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import './index.css';
import App from './App';
import { theme } from './config/theme';

const element = document.getElementById('album-root');
if (element) {
  ReactDOM.createRoot(element).render(
    <React.StrictMode>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </React.StrictMode>
  );
}

// Export the App component
export { App };
