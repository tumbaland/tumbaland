import { Routes, Route } from 'react-router-dom';
import Landing from '../components/Landing';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
    </Routes>
  );
};

export default AppRoutes;
