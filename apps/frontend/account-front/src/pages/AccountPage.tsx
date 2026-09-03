import React from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router';
import { Box, Tabs, Tab } from '@mui/material';
import ProfileTab from '../components/tabs/ProfileTab';
import ApiKeysTab from '../components/tabs/ApiKeysTab';

const AccountPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // One list drives both the labels and the routing, so a tab cannot end up
  // selecting a path that renders something else.
  const tabs = [
    { path: '/profile', label: 'Profile' },
    { path: '/api-keys', label: 'API keys' }
  ];

  const getActiveTab = () => {
    const index = tabs.findIndex((tab) => location.pathname.includes(tab.path));
    return index === -1 ? 0 : index;
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    navigate(tabs[newValue].path);
  };

  return (
    <Box sx={{ width: '100%', mt: 2 }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={getActiveTab()} onChange={handleTabChange} aria-label="account tabs">
          {tabs.map((tab) => (
            <Tab key={tab.path} label={tab.label} />
          ))}
        </Tabs>
      </Box>
      <Box sx={{ mt: 3 }}>
        <Routes>
          <Route path="" element={<Navigate to="profile" replace />} />
          <Route path="profile" element={<ProfileTab />} />
          <Route path="api-keys" element={<ApiKeysTab />} />
        </Routes>
      </Box>
    </Box>
  );
};

export default AccountPage;
