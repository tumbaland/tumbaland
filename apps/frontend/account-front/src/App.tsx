import { EmbeddedRouter } from '@tumbaland/components';
import AppLayout from './components/AppLayout';
import AppRoutes from './routes';
import { useConfig } from './config/ConfigProvider';

function App() {
  const config = useConfig();

  return (
    <EmbeddedRouter appName="account-front" shellUrl={config.SHELL_FRONT_URL}>
      <AppLayout>
        <AppRoutes />
      </AppLayout>
    </EmbeddedRouter>
  );
}

export default App;
