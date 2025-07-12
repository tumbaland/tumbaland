import { Routes, Route } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import FinancialRecords from '../pages/FinancialRecords';
import TrackedTickersPage from '../pages/TrackedTickersPage';
import UserPortfolioPage from '../pages/UserPortfolioPage';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/records" element={<FinancialRecords />} />
      <Route path="/tracked-tickers" element={<TrackedTickersPage />} />
      <Route path="/user-portfolio" element={<UserPortfolioPage />} />
    </Routes>
  );
};

export default AppRoutes;
