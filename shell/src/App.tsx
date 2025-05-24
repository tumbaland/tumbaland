import { useState } from 'react';
import './App.css';

type AppName = 'home' | 'finance' | 'relationship';

interface AppConfig {
  name: string;
  url: string;
  port: number;
  description: string;
}

const apps: Record<Exclude<AppName, 'home'>, AppConfig> = {
  finance: {
    name: 'Finance Management',
    url: 'http://localhost:3001',
    port: 3001,
    description: 'Manage your finances, track transactions, and monitor expenses.'
  },
  relationship: {
    name: 'Relationship Manager',
    url: 'http://localhost:3002',
    port: 3002,
    description: 'Manage your contacts and relationships effectively.'
  }
};

function App() {
  const [currentApp, setCurrentApp] = useState<AppName>('home');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAppChange = async (appName: AppName) => {
    if (appName === 'home') {
      setCurrentApp('home');
      setError(null);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Check if the app is running by making a simple fetch request
      await fetch(apps[appName].url, {
        method: 'GET',
        mode: 'no-cors'
      });
      
      setCurrentApp(appName);
    } catch (err) {
      setError(`Failed to connect to ${apps[appName].name}. Please make sure it's running on port ${apps[appName].port}.`);
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="loading">
          <div>Loading application...</div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="error">
          <h3>Connection Error</h3>
          <p>{error}</p>
          <button 
            onClick={() => setCurrentApp('home')}
            className="retry-button"
          >
            Back to Home
          </button>
        </div>
      );
    }

    if (currentApp === 'home') {
      return (
        <div className="welcome-section">
          <h2>Welcome to TumbaLand</h2>
          <p>
            Your integrated platform for managing finances and relationships. 
            Select an application from the menu above or click on a card below to get started.
          </p>
          
          <div className="app-grid">
            <div 
              className="app-card finance"
              onClick={() => handleAppChange('finance')}
            >
              <h3>💰 Finance Management</h3>
              <p>{apps.finance.description}</p>
              <span className="port-info">Port: {apps.finance.port}</span>
            </div>
            
            <div 
              className="app-card relationship"
              onClick={() => handleAppChange('relationship')}
            >
              <h3>👥 Relationship Manager</h3>
              <p>{apps.relationship.description}</p>
              <span className="port-info">Port: {apps.relationship.port}</span>
            </div>
          </div>
        </div>
      );
    }

    // Render the selected micro-frontend in an iframe
    const app = apps[currentApp];
    return (
      <div className="iframe-container">
        <iframe
          src={app.url}
          title={app.name}
          width="100%"
          height="100%"
          style={{ border: 'none' }}
          onError={() => setError(`Failed to load ${app.name}`)}
        />
      </div>
    );
  };

  return (
    <div className="app">
      <header className="header">
        <div className="container">
          <h1>🌍 TumbaLand</h1>
          <p className="tagline">Simple Micro-Frontend Architecture</p>
        </div>
      </header>

      <nav className="nav">
        <div className="nav-container">
          <ul className="nav-list">
            <li
              className={`nav-item ${currentApp === 'home' ? 'active' : ''}`}
              onClick={() => handleAppChange('home')}
            >
              🏠 Home
            </li>
            <li
              className={`nav-item ${currentApp === 'finance' ? 'active' : ''}`}
              onClick={() => handleAppChange('finance')}
            >
              💰 Finance
            </li>
            <li
              className={`nav-item ${currentApp === 'relationship' ? 'active' : ''}`}
              onClick={() => handleAppChange('relationship')}
            >
              👥 Relationships
            </li>
          </ul>
        </div>
      </nav>

      <main className="container">
        <div className="main-content">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

export default App;
