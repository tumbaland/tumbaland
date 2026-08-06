import { Routes, Route, Navigate } from 'react-router';
import Dashboard from '../pages/Dashboard';
import NetWorthPage from '../pages/NetWorthPage';
import CashFlowPage from '../pages/CashFlowPage';
import InvestmentsPage from '../pages/InvestmentsPage';
import PortfolioPlanner from '../pages/PortfolioPlanner';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="" element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="net-worth" element={<NetWorthPage />} />
      <Route path="cash-flow" element={<CashFlowPage />} />
      <Route path="investments" element={<InvestmentsPage />} />
      <Route path="planner" element={<PortfolioPlanner />} />
    </Routes>
  );
};

export default AppRoutes;
