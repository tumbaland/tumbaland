import React from 'react';
import { Avatar, Box, Button, Typography } from '@mui/material';
import { ArrowBack as ArrowBackIcon, Edit as EditIcon } from '@mui/icons-material';
import { initials, tintFor } from '../groups/groupAvatar';

interface GroupDetailsHeaderProps {
  groupName: string;
  onBack: () => void;
  onEdit: () => void;
  currentUserRole?: string;
  memberCount?: number;
  /** Keys the avatar colour, so it matches the group's row in the list. */
  groupId?: string;
}

const ROLE_LINE: Record<string, string> = {
  owner: "You're the owner",
  admin: "You're an admin",
  member: "You're a member"
};

const GroupDetailsHeader: React.FC<GroupDetailsHeaderProps> = ({
  groupName,
  onBack,
  onEdit,
  currentUserRole,
  memberCount,
  groupId
}) => {
  const canEdit = currentUserRole === 'owner' || currentUserRole === 'admin';
  const tint = tintFor(groupId ?? groupName);
  const subtitle = [
    memberCount !== undefined ? `${memberCount} ${memberCount === 1 ? 'member' : 'members'}` : null,
    currentUserRole ? ROLE_LINE[currentUserRole] : null
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Box sx={{ mb: { xs: 2, sm: 3 } }}>
      <Button
        size="small"
        startIcon={<ArrowBackIcon />}
        onClick={onBack}
        aria-label="Back to groups"
        sx={{ ml: -1, mb: 1, color: 'text.secondary', textTransform: 'none', fontWeight: 600 }}
      >
        Groups
      </Button>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar
          variant="rounded"
          sx={{
            width: 52,
            height: 52,
            borderRadius: 2.5,
            bgcolor: `${tint}1f`,
            color: tint,
            fontWeight: 700,
            fontSize: '1.15rem',
            flexShrink: 0
          }}
        >
          {initials(groupName)}
        </Avatar>

        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="h5" component="h1" noWrap sx={{ fontWeight: 700, lineHeight: 1.25 }}>
            {groupName}
          </Typography>
          {subtitle && (
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
              {subtitle}
            </Typography>
          )}
        </Box>

        {/* Named for what the dialog does: it changes the name and nothing else. */}
        {canEdit && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<EditIcon />}
            onClick={onEdit}
            sx={{ flexShrink: 0, textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
          >
            Rename
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default GroupDetailsHeader;
