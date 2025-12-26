import React from 'react';
import { Box, Fade, Paper, Typography, Button } from '@mui/material';
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
      <Fade in timeout={1000}>
        <Paper
          elevation={0}
          sx={{
            p: 6,
            textAlign: 'center',
            borderRadius: 3,
            border: '1px dashed',
            borderColor: 'divider',
            bgcolor: 'transparent'
          }}
        >
          <GroupIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom sx={{ fontWeight: 600 }}>
            No Groups Yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
            Start building your collaborative workspace by creating your first group.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={onCreateClick}
          >
            Create Your First Group
          </Button>
        </Paper>
      </Fade>
    );
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
        gap: 3
      }}
    >
      {groups.map((group, index) => (
        <Fade in timeout={500 + index * 100} key={group._id}>
          <Box>
            <GroupCard
              group={group}
              canModify={canModifyGroup(group)}
              userRole={getUserRole(group)}
              onMenuOpen={onMenuOpen}
            />
          </Box>
        </Fade>
      ))}
    </Box>
  );
};

export default GroupsList;
