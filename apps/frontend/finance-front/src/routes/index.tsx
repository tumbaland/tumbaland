import { Routes, Route } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import FinancialRecords from '../pages/FinancialRecords';
import TrackedTickersPage from '../pages/TrackedTickersPage';
import UserPortfolioPage from '../pages/UserPortfolioPage';
import TickerPriceHistoryPage from '../pages/TickerPriceHistoryPage';
import ProtectedRoute from '../components/ProtectedRoute';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/records" element={
        <ProtectedRoute>
          <FinancialRecords />
        </ProtectedRoute>
      } />
      <Route path="/tracked-tickers" element={
        <ProtectedRoute>
          <TrackedTickersPage />
        </ProtectedRoute>
      } />
      <Route path="/user-portfolio" element={
        <ProtectedRoute>
          <UserPortfolioPage />
        </ProtectedRoute>
      } />
      <Route path="/ticker-price-history" element={
        <ProtectedRoute>
          <TickerPriceHistoryPage />
        </ProtectedRoute>
      } />
    </Routes>
  );
};

export default AppRoutes;
