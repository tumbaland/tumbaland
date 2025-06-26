import { BrowserRouter } from 'react-router-dom';
import Layout from './components/Layout';
import WelcomeCard from './components/WelcomeCard';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <WelcomeCard />
      </Layout>
    </BrowserRouter>
  );
}

export default App;
