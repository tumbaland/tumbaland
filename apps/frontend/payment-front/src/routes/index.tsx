import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@tumbaland/components';
import PaymentsPage from '../pages/PaymentsPage';
import SubscriptionCheckoutPage from '../pages/SubscriptionCheckoutPage';
import TermsPage from '../pages/TermsPage';
import { authService } from '../services/authService';

const AppRoutes = () => (
  <Routes>
    <Route path="" element={<Navigate to="payments" replace />} />
    <Route path="payments/*" element={
      <ProtectedRoute authService={authService}>
        <PaymentsPage />
      </ProtectedRoute>
    } />
    <Route path="subscription/checkout" element={
      <ProtectedRoute authService={authService}>
        <SubscriptionCheckoutPage />
      </ProtectedRoute>
    } />
    <Route path="terms" element={<TermsPage />} />
  </Routes>
);

export default AppRoutes;
