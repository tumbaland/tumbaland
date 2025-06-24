import { BrowserRouter as Router } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import AppRoutes from './routes';
import ProtectedRoute from './components/ProtectedRoute';

function AppContent() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <AppRoutes />
      </AppLayout>
    </ProtectedRoute>
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
