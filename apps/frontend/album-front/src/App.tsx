import { EmbeddedRouter, ProtectedRoute } from '@tumbaland/components';
import AppLayout from './components/AppLayout';
import AppRoutes from './routes';
import { useConfig } from './config/ConfigProvider';
import { authService } from './services/authService';

function App() {
  const config = useConfig();

  return (
    <EmbeddedRouter appName="album-front" shellUrl={config.SHELL_FRONT_URL}>
      <ProtectedRoute authService={authService}>
        <AppLayout>
          <AppRoutes />
        </AppLayout>
      </ProtectedRoute>
    </EmbeddedRouter>
  );
}

export default App;
