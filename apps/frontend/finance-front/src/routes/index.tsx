import { Routes, Route } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import FinancialRecords from '../pages/FinancialRecords';
import TrackedTickersPage from '../pages/TrackedTickersPage';
import UserPortfolioPage from '../pages/UserPortfolioPage';
import StockGrowthCalculator from '../pages/StockGrowthCalculator';
import PortfolioOptimizer from '../pages/PortfolioOptimizer';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="" element={<Dashboard />} />
      <Route path="records" element={<FinancialRecords />} />
      <Route path="tracked-tickers" element={<TrackedTickersPage />} />
      <Route path="user-portfolio" element={<UserPortfolioPage />} />
      <Route path="stock-growth-calculator" element={<StockGrowthCalculator />} />
      <Route path="portfolio-optimizer" element={<PortfolioOptimizer />} />
    </Routes>
  );
};

export default AppRoutes;
