import { useState, useEffect } from 'react';
import './App.css';
import { loadAndMountMicrofrontend, MicroFrontendType, unmountAllMicrofrontends, unmountMicrofrontend } from './utils/microfrontend-loader';

function App() {
  const [currentApp, setCurrentApp] = useState<MicroFrontendType | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Handle app switching
    if (currentApp) {
      setIsLoading(true);
      const containerId = `${currentApp}-container`;
      
      // Load and mount the microfrontend
      loadAndMountMicrofrontend(currentApp, containerId)
        .finally(() => {
          setIsLoading(false);
        });
    }

    // Cleanup on component unmount
    return () => {
      unmountAllMicrofrontends();
    };
  }, [currentApp]);

  // Handle returning to home
  const handleGoHome = () => {
    if (currentApp) {
      const containerId = `${currentApp}-container`;
      unmountMicrofrontend(containerId);
    }
    setCurrentApp(null);
  };

  return (
    <div className="shell-container">
      <header className="shell-header">
        <h1>Tumbaland Microfrontend Application</h1>
        <nav>
          <button 
            onClick={() => setCurrentApp('finance')}
            className={currentApp === 'finance' ? 'active' : ''}
          >
            Finance App
          </button>
          <button 
            onClick={() => setCurrentApp('relationship')}
            className={currentApp === 'relationship' ? 'active' : ''}
          >
            Relationship App
          </button>
          {currentApp && (
            <button 
              onClick={handleGoHome}
              className="reset-button"
            >
              Home
            </button>
          )}
        </nav>
      </header>
      
      <main className="content-area">
        {/* Container divs - always in DOM but hidden when not active */}
        <div 
          id="finance-container" 
          className="app-container" 
          style={{ display: currentApp === 'finance' ? 'flex' : 'none' }}
        >
          {isLoading && currentApp === 'finance' && (
            <div className="loading">Loading Finance microfrontend...</div>
          )}
        </div>
        
        <div 
          id="relationship-container" 
          className="app-container"
          style={{ display: currentApp === 'relationship' ? 'flex' : 'none' }}
        >
          {isLoading && currentApp === 'relationship' && (
            <div className="loading">Loading Relationship microfrontend...</div>
          )}
        </div>
        
        <div 
          className="welcome"
          style={{ display: !currentApp ? 'block' : 'none' }}
        >
          <h2>Welcome to the Shell Application</h2>
          <p>Please select a microfrontend from the navigation above</p>
          <div className="tech-stack">
            <p>Built with:</p>
            <ul>
              <li>React v19</li>
              <li>TypeScript</li>
              <li>Vite</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;