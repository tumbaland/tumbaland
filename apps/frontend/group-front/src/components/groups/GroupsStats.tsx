import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { Group as GroupIcon, Person as PersonIcon, WorkspacePremium as WorkspacePremiumIcon } from '@mui/icons-material';
import { Group } from '../../types';

interface GroupsStatsProps {
  groups: Group[];
  getUserRole: (group: Group) => string;
}

const GroupsStats: React.FC<GroupsStatsProps> = ({ groups, getUserRole }) => {
  if (groups.length === 0) return null;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
        gap: 2,
        mb: 4
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 2,
          textAlign: 'center',
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        <GroupIcon color="primary" sx={{ fontSize: 32, mb: 0.5 }} />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {groups.length}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Total Groups
        </Typography>
      </Paper>
      <Paper
        elevation={0}
        sx={{
          p: 2,
          textAlign: 'center',
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        <PersonIcon color="primary" sx={{ fontSize: 32, mb: 0.5 }} />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {groups.reduce((acc, group) => acc + (group.members?.length || 1), 0)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Team Members
        </Typography>
      </Paper>
      <Paper
        elevation={0}
        sx={{
          p: 2,
          textAlign: 'center',
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        <WorkspacePremiumIcon color="primary" sx={{ fontSize: 32, mb: 0.5 }} />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {groups.filter(g => getUserRole(g) === 'owner').length}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Owned Groups
        </Typography>
      </Paper>
    </Box>
  );
};

export default GroupsStats;
