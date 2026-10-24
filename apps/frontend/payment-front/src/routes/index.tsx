import { Navigate, Routes, Route } from 'react-router';
import { ProtectedRoute } from '@tumbaland/frontend-core';
import PaymentsPage from '../pages/PaymentsPage';
import SubscriptionCheckoutPage from '../pages/SubscriptionCheckoutPage';
import { authService } from '../services/authService';

const AppRoutes = () => (
  <Routes>
    <Route path="subscription/checkout" element={
      <ProtectedRoute authService={authService}>
        <SubscriptionCheckoutPage />
      </ProtectedRoute>
    } />
    {/* The terms used to live here; any old link (a receipt, Stripe's settings)
        goes on to the one copy the shell serves. */}
    <Route path="terms" element={<Navigate to="/terms" replace />} />
    {/* Tabs live at the root; the static routes above outrank this splat. */}
    <Route path="/*" element={
      <ProtectedRoute authService={authService}>
        <PaymentsPage />
      </ProtectedRoute>
    } />
  </Routes>
);

export default AppRoutes;
