import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

interface GroupsHeaderProps {
  onCreateClick: () => void;
}

const GroupsHeader: React.FC<GroupsHeaderProps> = ({ onCreateClick }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 2,
        mb: { xs: 2, sm: 3 }
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.25 }}>
          Groups
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          Share albums, money and your journal with people you choose.
        </Typography>
      </Box>
      {/* Short label and no wrapping, so it stays one tidy button beside the
          title on a phone instead of a two-line block. */}
      <Button
        variant="contained"
        disableElevation
        startIcon={<AddIcon />}
        onClick={onCreateClick}
        sx={{ flexShrink: 0, whiteSpace: 'nowrap', textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
      >
        New group
      </Button>
    </Box>
  );
};

export default GroupsHeader;
