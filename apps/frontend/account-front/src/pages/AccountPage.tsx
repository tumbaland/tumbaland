import React from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { Container } from '@mui/material';
import ProfileTab from '../components/tabs/ProfileTab';
import ApiKeysTab from '../components/tabs/ApiKeysTab';
import ConnectionsTab from '../components/tabs/ConnectionsTab';
import ActivityTab from '../components/tabs/ActivityTab';
import DevicesTab from '../components/tabs/DevicesTab';
import { gutter } from '@tumbaland/frontend-core';

/**
 * This app's sections, one route each.
 *
 * The page used to draw its own row of MUI `Tabs` above them. Inside the shell
 * that sat directly under the shell's own header, so Profile carried two
 * navigations that looked nothing alike, and the tab labels were a second list
 * that could drift from the routes below. The names now come from
 * `../sections`, which both the shell's header and this app's standalone one
 * read.
 *
 * The width cap and the gutter are here rather than in each section, so every
 * one of the five is the same shape. Four of them were a bare `<Box>`: inside
 * the shell, which hands a module the full width and no padding, they ran from
 * the rail to the right edge while Profile sat capped at 800 in the middle.
 */
const AccountPage: React.FC = () => (
  <Container maxWidth="md" sx={{ py: { xs: 2, sm: 3 }, px: gutter }}>
    <Routes>
      <Route path="" element={<Navigate to="profile" replace />} />
      <Route path="profile" element={<ProfileTab />} />
      <Route path="devices" element={<DevicesTab />} />
      <Route path="connections" element={<ConnectionsTab />} />
      <Route path="api-keys" element={<ApiKeysTab />} />
      <Route path="activity" element={<ActivityTab />} />
    </Routes>
  </Container>
);

export default AccountPage;
