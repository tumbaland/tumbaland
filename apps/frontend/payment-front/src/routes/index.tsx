import { Routes, Route, Navigate } from 'react-router-dom';
import PaymentsPage from '../pages/PaymentsPage';
import SubscriptionCheckoutPage from '../pages/SubscriptionCheckoutPage';
import TermsPage from '../pages/TermsPage';
import { ProtectedRoute } from '../components/ProtectedRoute';

const AppRoutes = () => (
  <Routes>
    <Route path="" element={<Navigate to="payments" replace />} />
    <Route path="payments/*" element={
      <ProtectedRoute>
        <PaymentsPage />
      </ProtectedRoute>
    } />
    <Route path="subscription/checkout" element={
      <ProtectedRoute>
        <SubscriptionCheckoutPage />
      </ProtectedRoute>
    } />
    <Route path="terms" element={<TermsPage />} />
  </Routes>
);

export default AppRoutes;
