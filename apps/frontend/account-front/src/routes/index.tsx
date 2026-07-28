import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '@tumbaland/components';
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
