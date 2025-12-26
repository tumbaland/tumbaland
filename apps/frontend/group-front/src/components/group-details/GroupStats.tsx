import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { Person as PersonIcon, AdminPanelSettings as AdminPanelSettingsIcon, WorkspacePremium as WorkspacePremiumIcon } from '@mui/icons-material';
import { Group } from '../../types';

interface GroupStatsProps {
  group: Group;
}

const GroupStats: React.FC<GroupStatsProps> = ({ group }) => {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
        gap: 3,
        mb: 4
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 3,
          textAlign: 'center',
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        <PersonIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {group.members?.length || 0}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Total Members
        </Typography>
      </Paper>
      <Paper
        elevation={0}
        sx={{
          p: 3,
          textAlign: 'center',
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        <AdminPanelSettingsIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {group.members?.filter(m => m.role === 'admin' || m.role === 'owner').length || 0}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Admins
        </Typography>
      </Paper>
      <Paper
        elevation={0}
        sx={{
          p: 3,
          textAlign: 'center',
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        <WorkspacePremiumIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {group.members?.filter(m => m.role === 'owner').length || 0}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Owners
        </Typography>
      </Paper>
    </Box>
  );
};

export default GroupStats;
