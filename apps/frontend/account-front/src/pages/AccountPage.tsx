import React from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router';
import { Box, Tabs, Tab } from '@mui/material';
import ProfileTab from '../components/tabs/ProfileTab';

const AccountPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine active tab based on current path
  const getActiveTab = () => {
    if (location.pathname.includes('/security')) return 1;
    if (location.pathname.includes('/data')) return 2;
    return 0; // default to profile
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    const paths = ['/profile', '/security', '/data'];
    navigate(paths[newValue]);
  };

  return (
    <Box sx={{ width: '100%', mt: 2 }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={getActiveTab()} onChange={handleTabChange} aria-label="account tabs">
          <Tab label="Profile" />
        </Tabs>
      </Box>
      <Box sx={{ mt: 3 }}>
        <Routes>
          <Route path="" element={<Navigate to="profile" replace />} />
          <Route path="profile" element={<ProfileTab />} />
        </Routes>
      </Box>
    </Box>
  );
};

export default AccountPage;
