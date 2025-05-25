import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import './App.css';
import { Header } from './components';
import { AppRoutes } from './routes';
import { AppLink } from './types/AppLink';

const apps: AppLink[] = [
  {
    name: 'Finance Portfolio',
    description: 'Track your investments, assets, and financial performance with comprehensive analytics.',
    url: 'http://localhost:3001',
    route: '/finance',
    icon: '💰',
    color: '#2563eb',
    gradient: 'linear-gradient(135deg, #2563eb, #1d4ed8)'
  },
  {
    name: 'Relationship Activities',
    description: 'Manage and track your relationship activities, dates, and quality time together.',
    url: 'http://localhost:3002',
    route: '/relationship',
    icon: '💕',
    color: '#9c27b0',
    gradient: 'linear-gradient(135deg, #9c27b0, #673ab7)'
  }
];

function App() {
  const [loading, setLoading] = useState(false);
  const location = useLocation();

  // Find current app based on route
  const currentApp = apps.find(app => app.route === location.pathname);

  // Set loading when navigating to an app route
  useEffect(() => {
    if (currentApp) {
      setLoading(true);
      // Reset loading after a brief delay to show loading state
      const timer = setTimeout(() => setLoading(false), 500);
      return () => clearTimeout(timer);
    }
  }, [currentApp]);

  const handleIframeLoad = () => {
    setLoading(false);
  };

  return (
    <div className="shell-app">
      {/* Header - Always visible */}
      <Header apps={apps} />

      {/* Main Content Area */}
      <main className="shell-main">
        <AppRoutes 
          apps={apps}
          loading={loading}
          onIframeLoad={handleIframeLoad}
        />
      </main>
    </div>
  );
}

export default App;
