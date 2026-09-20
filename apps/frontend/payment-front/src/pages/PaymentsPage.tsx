import React from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { Container } from '@mui/material';
import PlansTab from '../components/tabs/PlansTab';
import SubscriptionsTab from '../components/tabs/SubscriptionsTab';
import PaymentsTab from '../components/tabs/PaymentsTab';
import { gutter } from '@tumbaland/frontend-core';

/**
 * This app's sections, one route each. The row of MUI `Tabs` that used to sit
 * above them is gone: the header bar names the sections now, the same one the
 * other modules get (see `../sections`).
 *
 * The width cap and the gutter are here rather than in each section, so all
 * three are the same shape. Inside the shell a module is handed the full width
 * and no padding, which left these running edge to edge.
 */
const PaymentsPage: React.FC = () => (
  <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 }, px: gutter }}>
    <Routes>
      <Route path="/" element={<Navigate to="plans" replace />} />
      <Route path="plans" element={<PlansTab />} />
      <Route path="subscriptions" element={<SubscriptionsTab />} />
      <Route path="history" element={<PaymentsTab />} />
    </Routes>
  </Container>
);

export default PaymentsPage;
