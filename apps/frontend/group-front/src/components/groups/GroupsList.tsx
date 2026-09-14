import React from 'react';
import { Box, Paper, Typography, Button } from '@mui/material';
import { Add as AddIcon, Group as GroupIcon } from '@mui/icons-material';
import { Group } from '../../types';
import GroupCard from './GroupCard';

interface GroupsListProps {
  groups: Group[];
  canModifyGroup: (group: Group) => boolean;
  getUserRole: (group: Group) => string;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>, group: Group) => void;
  onCreateClick: () => void;
}

const GroupsList: React.FC<GroupsListProps> = ({
  groups,
  canModifyGroup,
  getUserRole,
  onMenuOpen,
  onCreateClick
}) => {
  if (groups.length === 0) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, sm: 6 },
          textAlign: 'center',
          borderRadius: 3,
          border: '1px dashed',
          borderColor: 'divider',
          bgcolor: 'transparent'
        }}
      >
        <GroupIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1.5, opacity: 0.5 }} />
        <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 600, mb: 0.5 }}>
          No groups yet
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, maxWidth: 360, mx: 'auto' }}>
          Create one, then invite the people you want to share with.
        </Typography>
        <Button
          variant="contained"
          disableElevation
          startIcon={<AddIcon />}
          onClick={onCreateClick}
          sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
        >
          Create your first group
        </Button>
      </Paper>
    );
  }

  return (
    <Box
      component="ul"
      sx={{
        listStyle: 'none',
        m: 0,
        p: 0,
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
        gap: 1.5
      }}
    >
      {groups.map((group) => (
        <Box component="li" key={group._id}>
          <GroupCard
            group={group}
            canModify={canModifyGroup(group)}
            userRole={getUserRole(group)}
            onMenuOpen={onMenuOpen}
          />
        </Box>
      ))}
    </Box>
  );
};

export default GroupsList;
