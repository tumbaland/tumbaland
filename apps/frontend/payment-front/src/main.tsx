import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppErrorBoundary } from '@tumbaland/frontend-core';
import App from './App';
import { ConfigProvider } from './config/ConfigProvider';

const element = document.getElementById('payment-root');
if (element) {
  ReactDOM.createRoot(element).render(
    <React.StrictMode>
      <AppErrorBoundary component="payment-front">
        <ConfigProvider>
          <App />
        </ConfigProvider>
      </AppErrorBoundary>
    </React.StrictMode>
  );
}
