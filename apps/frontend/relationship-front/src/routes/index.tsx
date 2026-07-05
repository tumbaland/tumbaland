import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import JournalPage from '../pages/JournalPage';
import ActivityTypesPage from '../pages/ActivityTypesPage';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="" element={<Dashboard />} />
      <Route path="journal" element={<JournalPage />} />
      {/* old bookmark compatibility */}
      <Route path="activities" element={<Navigate to="/journal" replace />} />
      <Route path="activity-types" element={<ActivityTypesPage />} />
    </Routes>
  );
};

export default AppRoutes;
