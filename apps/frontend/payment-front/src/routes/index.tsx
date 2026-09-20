import { Routes, Route } from 'react-router';
import { ProtectedRoute } from '@tumbaland/frontend-core';
import PaymentsPage from '../pages/PaymentsPage';
import SubscriptionCheckoutPage from '../pages/SubscriptionCheckoutPage';
import TermsPage from '../pages/TermsPage';
import { authService } from '../services/authService';

const AppRoutes = () => (
  <Routes>
    <Route path="subscription/checkout" element={
      <ProtectedRoute authService={authService}>
        <SubscriptionCheckoutPage />
      </ProtectedRoute>
    } />
    <Route path="terms" element={<TermsPage />} />
    {/* Tabs live at the root; the static routes above outrank this splat. */}
    <Route path="/*" element={
      <ProtectedRoute authService={authService}>
        <PaymentsPage />
      </ProtectedRoute>
    } />
  </Routes>
);

export default AppRoutes;
