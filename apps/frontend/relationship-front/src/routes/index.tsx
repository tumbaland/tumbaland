import { Routes, Route } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import Activities from '../pages/Activities';
import ActivityTypesPage from '../pages/ActivityTypesPage';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/activities" element={<Activities />} />
      <Route path="/activity-types" element={<ActivityTypesPage />} />
    </Routes>
  );
};

export default AppRoutes;
