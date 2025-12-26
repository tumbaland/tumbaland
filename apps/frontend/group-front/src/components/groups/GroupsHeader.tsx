import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

interface GroupsHeaderProps {
  onCreateClick: () => void;
}

const GroupsHeader: React.FC<GroupsHeaderProps> = ({ onCreateClick }) => {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
      <Box>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700, color: 'text.primary' }}>
          My Groups
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage your teams and projects
        </Typography>
      </Box>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={onCreateClick}
      >
        Create Group
      </Button>
    </Box>
  );
};

export default GroupsHeader;
