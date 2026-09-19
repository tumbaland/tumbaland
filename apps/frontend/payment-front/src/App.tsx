import { EmbeddedRouter } from '@tumbaland/components';
import AppLayout from './components/AppLayout';
import AppRoutes from './routes';
import { useConfig } from './config/ConfigProvider';

// No ThemeProvider here: this app used to build a bare `createTheme()`, which
// overrode the shared theme ConfigProvider supplies and put MUI's factory blue
// and Roboto back on every billing page.
function App() {
  const config = useConfig();

  return (
    <EmbeddedRouter appName="payment-front" shellUrl={config.SHELL_FRONT_URL}>
      <AppLayout>
        <AppRoutes />
      </AppLayout>
    </EmbeddedRouter>
  );
}

export default App;
