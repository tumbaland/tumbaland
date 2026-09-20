import React from 'react';
import { Avatar, Box, Chip, IconButton, Paper, Typography } from '@mui/material';
import { ChevronRight as ChevronRightIcon, MoreVert as MoreVertIcon } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router';
import { Group } from '../../types';
import { initials, tintFor } from './groupAvatar';
import { appPath } from '../../appBase';

interface GroupCardProps {
  group: Group;
  canModify: boolean;
  userRole: string;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>, group: Group) => void;
}

/**
 * One group as a compact row.
 *
 * The row itself is the link. The options button sits beside it rather than
 * inside it: a button nested in a link is invalid markup, and it used to need
 * preventDefault to stop a menu tap from also opening the group.
 */
const GroupCard: React.FC<GroupCardProps> = ({ group, canModify, userRole, onMenuOpen }) => {
  const memberCount = group.members?.length || 1;
  const tint = tintFor(group._id ?? group.name);

  return (
    <Paper
      elevation={0}
      sx={{
        display: 'flex',
        alignItems: 'center',
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        '&:hover': { borderColor: 'primary.main', boxShadow: '0 6px 18px -12px rgba(15, 23, 42, 0.35)' }
      }}
    >
      <Box
        component={RouterLink}
        to={appPath(`/${group._id}`)}
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          p: 1.5,
          color: 'inherit',
          textDecoration: 'none',
          borderRadius: 3,
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 }
        }}
      >
        <Avatar
          variant="rounded"
          sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: `${tint}1f`, color: tint, fontWeight: 700, fontSize: '1rem' }}
        >
          {initials(group.name)}
        </Avatar>

        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography component="h2" noWrap sx={{ fontWeight: 600, fontSize: '1rem', lineHeight: 1.3 }}>
            {group.name}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {memberCount} member{memberCount !== 1 ? 's' : ''}
            </Typography>
            <Chip
              label={userRole}
              size="small"
              color={userRole === 'owner' ? 'primary' : 'default'}
              variant={userRole === 'owner' ? 'filled' : 'outlined'}
              sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600, textTransform: 'capitalize' }}
            />
          </Box>
        </Box>

        {!canModify && <ChevronRightIcon sx={{ color: 'text.disabled' }} />}
      </Box>

      {canModify && (
        <IconButton aria-label={`Options for ${group.name}`} onClick={(e) => onMenuOpen(e, group)} sx={{ mr: 1 }}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
      )}
    </Paper>
  );
};

export default GroupCard;
