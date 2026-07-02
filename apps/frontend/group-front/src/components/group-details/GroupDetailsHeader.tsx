import React from 'react';
import { Box, Button, Avatar, Typography } from '@mui/material';
import { ArrowBack as ArrowBackIcon, Group as GroupIcon, Edit as EditIcon } from '@mui/icons-material';

interface GroupDetailsHeaderProps {
  groupName: string;
  onBack: () => void;
  onEdit: () => void;
  currentUserRole?: string;
}

const GroupDetailsHeader: React.FC<GroupDetailsHeaderProps> = ({
  groupName,
  onBack,
  onEdit,
  currentUserRole
}) => {
  const canEdit = currentUserRole === 'owner' || currentUserRole === 'admin';

  return (
    <Box
      sx={{
        bgcolor: 'white',
        borderBottom: '1px solid',
        borderColor: 'divider',
        pt: 4,
        pb: 8,
        px: { xs: 2, sm: 4 }
      }}
    >
      <Box sx={{ maxWidth: 'lg', mx: 'auto' }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={onBack}
          sx={{ mb: 3, color: 'text.secondary' }}
        >
          Back to Groups
        </Button>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Avatar
              sx={{
                width: 64,
                height: 64,
                bgcolor: 'primary.main',
                fontSize: '2rem'
              }}
            >
              <GroupIcon fontSize="inherit" />
            </Avatar>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                {groupName}
              </Typography>
              <Typography variant="body1" sx={{
                color: "text.secondary"
              }}>
                Group Details
              </Typography>
            </Box>
          </Box>

          {canEdit && (
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={onEdit}
              sx={{ borderRadius: 2 }}
            >
              Edit Group
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default GroupDetailsHeader;
