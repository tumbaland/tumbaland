import { BrowserRouter as Router } from 'react-router-dom';
import { ConfigProvider } from './config/ConfigProvider';
import AppRoutes from './routes';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';

function App() {
  return (
    <Router>
      <ConfigProvider>
        <ProtectedRoute>
          <AppLayout>
            <AppRoutes />
          </AppLayout>
        </ProtectedRoute>
      </ConfigProvider>
    </Router>
  );
}

export default App;
