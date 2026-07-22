import { BrowserRouter as Router } from 'react-router-dom';
import { ProtectedRoute } from '@tumbaland/components';
import AppLayout from './components/AppLayout';
import AppRoutes from './routes';
import { authService } from './services/authService';

function App() {
  return (
    <Router>
      <ProtectedRoute authService={authService}>
        <AppLayout>
          <AppRoutes />
        </AppLayout>
      </ProtectedRoute>
    </Router>
  );
}

export default App;
