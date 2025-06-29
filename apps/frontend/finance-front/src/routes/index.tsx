import { Routes, Route } from "react-router-dom";
import Dashboard from "../pages/Dashboard";
import FinancialRecords from "../pages/FinancialRecords";
import TrackedTickersPage from "../pages/TrackedTickersPage";
import UserPortfolioPage from "../pages/UserPortfolioPage";
import TickerPriceHistoryPage from "../pages/TickerPriceHistoryPage";

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/records" element={<FinancialRecords />} />
      <Route path="/tracked-tickers" element={<TrackedTickersPage />} />
      <Route path="/user-portfolio" element={<UserPortfolioPage />} />
      <Route
        path="/ticker-price-history"
        element={<TickerPriceHistoryPage />}
      />
    </Routes>
  );
};

export default AppRoutes;
