import { Routes, Route } from 'react-router-dom';
import GroupDetailsPage from '../pages/GroupDetailsPage';
import { ProtectedRoute } from '../components/ProtectedRoute';
import GroupsPage from '../pages/GroupsPage';

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={
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
