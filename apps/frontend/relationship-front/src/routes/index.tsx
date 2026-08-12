import { Routes, Route, Navigate } from 'react-router';
import Dashboard from '../pages/Dashboard';
import JournalPage from '../pages/JournalPage';
import MapPage from '../pages/MapPage';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="" element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="journal" element={<JournalPage />} />
      <Route path="map" element={<MapPage />} />
    </Routes>
  );
};

export default AppRoutes;
