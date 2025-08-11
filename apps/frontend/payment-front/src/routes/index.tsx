import { Routes, Route } from 'react-router-dom';
import PlansPage from '../pages/PlansPage';
import SubscriptionPage from '../pages/SubscriptionPage';
import SubscriptionCheckoutPage from '../pages/SubscriptionCheckoutPage';
import PaymentsHistoryPage from '../pages/PaymentsHistoryPage';
import TermsPage from '../pages/TermsPage';

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<PlansPage />} />
    <Route path="/subscription" element={<SubscriptionPage />} />
  <Route path="/subscription/checkout" element={<SubscriptionCheckoutPage />} />
    <Route path="/payments" element={<PaymentsHistoryPage />} />
  <Route path="/terms" element={<TermsPage />} />
  </Routes>
);

export default AppRoutes;
