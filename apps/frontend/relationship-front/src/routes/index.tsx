import { Routes, Route, Navigate } from 'react-router';
import Dashboard from '../pages/Dashboard';
import JournalPage from '../pages/JournalPage';
import ActivityTypesPage from '../pages/ActivityTypesPage';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="" element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="journal" element={<JournalPage />} />
      <Route path="activity-types" element={<ActivityTypesPage />} />
    </Routes>
  );
};

export default AppRoutes;
