import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import AppRoutes from './routes';
import { AppConfig } from './config/ConfigProvider';

// Create the configuration context
export const ConfigContext = React.createContext<AppConfig>({});

function AppContent() {
  return (
    <AppLayout>
      <AppRoutes />
    </AppLayout>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
