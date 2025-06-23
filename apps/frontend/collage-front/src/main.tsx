import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const element = document.getElementById('collage-root');
if (element) {
  ReactDOM.createRoot(element).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// Export the App component
export { App };
