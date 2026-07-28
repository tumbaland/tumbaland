import { EmbeddedRouter } from '@tumbaland/components';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import AppLayout from './components/AppLayout';
import AppRoutes from './routes';
import { useConfig } from './config/ConfigProvider';

const theme = createTheme();

function App() {
  const config = useConfig();

  return (
    <ThemeProvider theme={theme}>
      <EmbeddedRouter appName="payment-front" shellUrl={config.SHELL_FRONT_URL}>
        <AppLayout>
          <AppRoutes />
        </AppLayout>
      </EmbeddedRouter>
    </ThemeProvider>
  );
}

export default App;
