import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const element = document.getElementById('relationship-root');
if (element) {
  ReactDOM.createRoot(element).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// Export the App component
export { App };