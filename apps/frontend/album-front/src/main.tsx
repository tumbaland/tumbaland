import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { AppErrorBoundary } from '@tumbaland/frontend-core';
import App from './App';
import { ConfigProvider } from './config/ConfigProvider';
import { queryClient } from './lib/queryClient';

const element = document.getElementById('album-root');
if (element) {
  ReactDOM.createRoot(element).render(
    <React.StrictMode>
      <AppErrorBoundary component="album-front">
        <QueryClientProvider client={queryClient}>
          <ConfigProvider>
            <App />
          </ConfigProvider>
        </QueryClientProvider>
      </AppErrorBoundary>
    </React.StrictMode>
  );
}
