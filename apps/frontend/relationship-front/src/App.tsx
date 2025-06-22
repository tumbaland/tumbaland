import { BrowserRouter as Router } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import AppRoutes from './routes';

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
