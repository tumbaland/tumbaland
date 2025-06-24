import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import LoginPage from './pages/LoginPage';

const element = document.getElementById('auth-root');
if (element) {
  ReactDOM.createRoot(element).render(
    <React.StrictMode>
      <LoginPage />
    </React.StrictMode>
  );
}

// Export the App component
export { LoginPage };
