import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Track active root to enable proper cleanup
let activeRoot: ReactDOM.Root | null = null;

// Create a function to mount the app to a specific element
export function mount(elementId: string) {
  // Unmount any existing instance first
  unmount();
  
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id "${elementId}" not found`);
    return;
  }
  
  try {
    // Create a new root
    activeRoot = ReactDOM.createRoot(element);
    
    // Render the app into the root
    activeRoot.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error('Error mounting relationship microfrontend:', error);
    activeRoot = null;
  }
}

// Create a function to unmount the app
export function unmount() {
  if (activeRoot) {
    try {
      activeRoot.unmount();
    } catch (error) {
      console.error('Error unmounting relationship microfrontend:', error);
    }
    activeRoot = null;
  }
}

// For standalone development
if (import.meta.env.DEV) {
  const element = document.getElementById('relationship-root');
  if (element) {
    ReactDOM.createRoot(element).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
}

// Export the App component
export { App };