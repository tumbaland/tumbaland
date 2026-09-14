import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { Group } from '../../types';

interface GroupStatsProps {
  group: Group;
}

/** One compact strip, matching the groups list. Admins counts the owner too. */
const GroupStats: React.FC<GroupStatsProps> = ({ group }) => {
  const members = group.members ?? [];
  const items = [
    { label: 'Members', value: members.length },
    { label: 'Admins', value: members.filter((m) => m.role === 'admin' || m.role === 'owner').length },
    { label: 'Owners', value: members.filter((m) => m.role === 'owner').length }
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

export default GroupStats;
