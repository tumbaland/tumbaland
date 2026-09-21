import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppErrorBoundary } from '@tumbaland/frontend-core';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary component="chat-front">
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);
