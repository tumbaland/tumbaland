import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppErrorBoundary } from '@tumbaland/components';
import App from './App';
import { ConfigProvider } from './config/ConfigProvider';

const element = document.getElementById('account-root');
if (element) {
  ReactDOM.createRoot(element).render(
    <React.StrictMode>
      <AppErrorBoundary component="account-front">
        <ConfigProvider>
          <App />
        </ConfigProvider>
      </AppErrorBoundary>
    </React.StrictMode>
  );
}
