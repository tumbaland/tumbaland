import { Routes, Route } from 'react-router';
import { ProtectedRoute } from '@tumbaland/frontend-core';
import AccountPage from '../pages/AccountPage';
import { authService } from '../services/authService';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/*" element={
        <ProtectedRoute authService={authService}>
          <AccountPage />
        </ProtectedRoute>
      } />
    </Routes>
  );
};

export default AppRoutes;
