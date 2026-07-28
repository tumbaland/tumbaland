import { EmbeddedRouter } from '@tumbaland/components';
import { ConfigProvider, useConfig } from './config/ConfigProvider';
import AppRoutes from './routes';
import AppLayout from './components/AppLayout';

// The router needs SHELL_FRONT_URL to know where to post location updates, so
// ConfigProvider now sits above it rather than inside.
function AppShell() {
  const config = useConfig();

  return (
    <EmbeddedRouter appName="group-front" shellUrl={config.SHELL_FRONT_URL}>
      <AppLayout>
        <AppRoutes />
      </AppLayout>
    </EmbeddedRouter>
  );
}

function App() {
  return (
    <ConfigProvider>
      <AppShell />
    </ConfigProvider>
  );
}

export default App;
