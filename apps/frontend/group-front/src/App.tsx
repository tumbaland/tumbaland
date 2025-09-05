import { BrowserRouter as Router } from 'react-router-dom';
import { ConfigProvider } from './config/ConfigProvider';
import AppRoutes from './routes';
import AppLayout from './components/AppLayout';

function App() {
  return (
    <Router>
      <ConfigProvider>
        <AppLayout>
          <AppRoutes />
        </AppLayout>
      </ConfigProvider>
    </Router>
  );
}

export default App;
