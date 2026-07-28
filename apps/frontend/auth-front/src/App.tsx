import { BrowserRouter as Router } from 'react-router';
import AppLayout from './components/AppLayout';
import AppRoutes from './routes';

function App() {
  return (
    <Router>
      <AppLayout>
        <AppRoutes />
      </AppLayout>
    </Router>
  );
}

export default App;
