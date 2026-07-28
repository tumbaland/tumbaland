import React from 'react';
import { useNavigate } from 'react-router';
import { Box, Tabs, Tab } from '@mui/material';
import GroupsTab from '../components/tabs/GroupsTab';

const GroupsPage: React.FC = () => {
  const navigate = useNavigate();

  // Determine active tab based on current path
  const getActiveTab = () => {
    return 0; // Only one tab for now
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    // For future tabs, we can add more paths here
    const paths = ['/'];
    navigate(paths[newValue]);
  };

  return (
    <Box sx={{ width: '100%', mt: 2 }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={getActiveTab()} onChange={handleTabChange} aria-label="groups tabs">
          <Tab label="My Groups" />
        </Tabs>
      </Box>
      <Box sx={{ mt: 3 }}>
        <GroupsTab />
      </Box>
    </Box>
  );
};

export default GroupsPage;
