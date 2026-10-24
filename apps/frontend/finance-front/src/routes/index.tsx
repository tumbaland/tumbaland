import { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { Loader, lazyPage } from '@tumbaland/frontend-core';

// One chunk per page: the charts library alone is most of what a visit to the
// dashboard does not need on the way to the cash-flow page, and the other way round.
const Dashboard = lazyPage(() => import('../pages/Dashboard'));
const NetWorthPage = lazyPage(() => import('../pages/NetWorthPage'));
const CashFlowPage = lazyPage(() => import('../pages/CashFlowPage'));
const InvestmentsPage = lazyPage(() => import('../pages/InvestmentsPage'));
const PortfolioPlanner = lazyPage(() => import('../pages/PortfolioPlanner'));

const AppRoutes = () => {
  return (
    <Suspense fallback={<Loader fullHeight={false} />}>
      <Routes>
        <Route path="" element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="net-worth" element={<NetWorthPage />} />
        <Route path="cash-flow" element={<CashFlowPage />} />
        <Route path="investments" element={<InvestmentsPage />} />
        <Route path="planner" element={<PortfolioPlanner />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
