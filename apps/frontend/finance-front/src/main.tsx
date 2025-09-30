import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ConfigProvider } from './config/ConfigProvider';
import { queryClient } from './lib/queryClient';

const element = document.getElementById('finance-root');
if (element) {
  ReactDOM.createRoot(element).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider>
          <App />
        </ConfigProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
}
