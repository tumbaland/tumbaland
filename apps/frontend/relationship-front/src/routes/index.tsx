import { Routes, Route } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import Activities from '../pages/Activities';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/activities" element={<Activities />} />
    </Routes>
  );
};

export default AppRoutes;
