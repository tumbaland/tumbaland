import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import NetWorthPage from '../pages/NetWorthPage';
import InvestmentsPage from '../pages/InvestmentsPage';
import StockGrowthCalculator from '../pages/StockGrowthCalculator';
import PortfolioOptimizer from '../pages/PortfolioOptimizer';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="" element={<Dashboard />} />
      <Route path="net-worth" element={<NetWorthPage />} />
      <Route path="investments" element={<InvestmentsPage />} />
      <Route path="stock-growth-calculator" element={<StockGrowthCalculator />} />
      <Route path="portfolio-optimizer" element={<PortfolioOptimizer />} />
      {/* Old bookmarks from the pre-refactor navigation */}
      <Route path="asset-allocations" element={<Navigate to="/net-worth" replace />} />
      <Route path="asset-classes" element={<Navigate to="/net-worth" replace />} />
      <Route path="user-portfolio" element={<Navigate to="/investments" replace />} />
      <Route path="tracked-tickers" element={<Navigate to="/investments" replace />} />
    </Routes>
  );
};

export default AppRoutes;
