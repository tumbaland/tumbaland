import React from 'react';
import { Box, Paper, Typography, IconButton, Avatar, CardContent, Stack, Chip, Button } from '@mui/material';
import { Group as GroupIcon, MoreVert as MoreVertIcon, Person as PersonIcon } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { Group } from '../../types';

interface GroupCardProps {
  group: Group;
  canModify: boolean;
  userRole: string;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>, group: Group) => void;
}

const GroupCard: React.FC<GroupCardProps> = ({ group, canModify, userRole, onMenuOpen }) => {
  return (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 3,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        '&:hover': {
          borderColor: 'primary.main',
          transform: 'translateY(-2px)'
        },
        position: 'relative'
      }}
      component={RouterLink}
      to={`/groups/${group._id}`}
    >
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Avatar
          sx={{
            bgcolor: 'primary.light',
            color: 'primary.main',
            width: 48,
            height: 48,
            borderRadius: 2
          }}
        >
          <GroupIcon />
        </Avatar>
        {canModify && (
          <IconButton
            size="small"
            onClick={(e) => {
              e.preventDefault();
              onMenuOpen(e, group);
            }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      <CardContent sx={{ flexGrow: 1, pt: 0, pb: 2 }}>
        <Typography variant="h6" component="h2" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
          {group.name}
        </Typography>

        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <PersonIcon fontSize="small" color="action" sx={{ fontSize: 16 }} />
          <Typography variant="body2" color="text.secondary">
            {group.members?.length || 1} member{(group.members?.length || 1) !== 1 ? 's' : ''}
          </Typography>
          <Chip
            label={userRole}
            size="small"
            variant="outlined"
            color={userRole === 'owner' ? 'primary' : 'default'}
            sx={{ ml: 'auto', height: 20, fontSize: '0.7rem' }}
          />
        </Stack>

        <Button
          variant="outlined"
          fullWidth
          size="small"
          sx={{ mt: 'auto' }}
        >
          Open Group
        </Button>
      </CardContent>
    </Paper>
  );
};

export default GroupCard;
