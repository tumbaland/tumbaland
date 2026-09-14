import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { Group } from '../../types';

interface GroupsStatsProps {
  groups: Group[];
  getUserRole: (group: Group) => string;
}

/**
 * One compact strip. Three full-width tiles stacked on a phone took more height
 * than the groups they summarised.
 */
const GroupsStats: React.FC<GroupsStatsProps> = ({ groups, getUserRole }) => {
  if (groups.length === 0) return null;

  const items = [
    { label: groups.length === 1 ? 'Group' : 'Groups', value: groups.length },
    { label: 'Members', value: groups.reduce((acc, group) => acc + (group.members?.length || 1), 0) },
    { label: 'You own', value: groups.filter((g) => getUserRole(g) === 'owner').length }
  ];

  return (
    <Paper
      elevation={0}
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        mb: { xs: 2, sm: 3 },
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden'
      }}
    >
      {items.map((item, index) => (
        <Box
          key={item.label}
          sx={{
            px: 1,
            py: 1.5,
            textAlign: 'center',
            borderLeft: index === 0 ? 'none' : '1px solid',
            borderColor: 'divider'
          }}
        >
          <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.2 }}>{item.value}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {item.label}
          </Typography>
        </Box>
      ))}
    </Paper>
  );
};

export default GroupsStats;
