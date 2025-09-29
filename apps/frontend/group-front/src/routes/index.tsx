import { Routes, Route, Navigate } from 'react-router-dom';
import GroupDetailsPage from '../pages/GroupDetailsPage';
import { ProtectedRoute } from '../components/ProtectedRoute';
import GroupsPage from '../pages/GroupsPage';

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Navigate to="/groups" replace />} />
    <Route path="/groups" element={
      <ProtectedRoute>
        <GroupsPage />
      </ProtectedRoute>
    } />
    <Route path="/groups/:id" element={
      <ProtectedRoute>
        <GroupDetailsPage />
      </ProtectedRoute>
    } />
  </Routes>
);

export default AppRoutes;
