import React from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Box, Tabs, Tab } from '@mui/material';
import PlansTab from '../components/tabs/PlansTab';
import SubscriptionsTab from '../components/tabs/SubscriptionsTab';
import PaymentsTab from '../components/tabs/PaymentsTab';

const PaymentsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine active tab based on current path
  const getActiveTab = () => {
    const path = location.pathname;
    if (path === '/payments' || path === '/payments/' || path.endsWith('/payments/plans') || path.endsWith('/plans')) {
      return 0; // plans
    }
    if (path.endsWith('/payments/subscriptions') || path.endsWith('/subscriptions')) return 1;
    if (path.endsWith('/payments/history') || path.endsWith('/history')) return 2;
    return 0; // default to plans
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    const paths = ['/payments/plans', '/payments/subscriptions', '/payments/history'];
    navigate(paths[newValue]);
  };

  return (
    <Box sx={{ width: '100%', mt: 2 }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={getActiveTab()} onChange={handleTabChange} aria-label="payments tabs">
          <Tab label="Plans" />
          <Tab label="Subscriptions" />
          <Tab label="Payments" />
        </Tabs>
      </Box>
      <Box sx={{ mt: 3 }}>
        <Routes>
          <Route path="/" element={<Navigate to="plans" replace />} />
          <Route path="plans" element={<PlansTab />} />
          <Route path="subscriptions" element={<SubscriptionsTab />} />
          <Route path="history" element={<PaymentsTab />} />
        </Routes>
      </Box>
    </Box>
  );
};

export default PaymentsPage;
