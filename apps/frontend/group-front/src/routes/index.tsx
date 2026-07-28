import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '@tumbaland/components';
import GroupDetailsPage from '../pages/GroupDetailsPage';
import GroupsPage from '../pages/GroupsPage';
import { authService } from '../services/authService';

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={
      <ProtectedRoute authService={authService}>
        <GroupsPage />
      </ProtectedRoute>
    } />
    <Route path="/:id" element={
      <ProtectedRoute authService={authService}>
        <GroupDetailsPage />
      </ProtectedRoute>
    } />
  </Routes>
);

export default AppRoutes;
