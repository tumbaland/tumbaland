import { Routes, Route, Navigate } from 'react-router';
import Dashboard from '../pages/Dashboard';
import JournalPage from '../pages/JournalPage';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="" element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="journal" element={<JournalPage />} />
      {/* The map is a card on the dashboard now; old links and bookmarks land there. */}
      <Route path="map" element={<Navigate to="../dashboard" replace />} />
    </Routes>
  );
};

export default AppRoutes;
