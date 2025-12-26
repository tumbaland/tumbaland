import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { Add } from '@mui/icons-material';

interface AssetAllocationHeaderProps {
  onAddClick: () => void;
}

const AssetAllocationHeader: React.FC<AssetAllocationHeaderProps> = ({ onAddClick }) => {
  return (
    <Box sx={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      mb: { xs: 2, sm: 2.5, md: 3 },
      flexWrap: 'wrap',
      gap: { xs: 1, sm: 1.5, md: 2 },
      minHeight: { xs: 'auto', sm: 56, md: 64 }
    }}>
      <Typography
        variant="h4"
        component="h1"
        sx={{
          fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2.125rem', lg: '2.25rem' },
          flex: { xs: '1 1 100%', sm: '0 1 auto' },
          minWidth: 0,
          mr: { xs: 0, sm: 2 }
        }}
      >
        Asset Allocations
      </Typography>
      <Button
        variant="contained"
        startIcon={<Add />}
        sx={{
          bgcolor: 'primary.main',
          fontSize: { xs: '0.8125rem', sm: '0.875rem', md: '0.9375rem' },
          px: { xs: 1.5, sm: 2, md: 2.5 },
          flex: { xs: '1 1 100%', sm: '0 0 auto' },
          minWidth: { xs: '100%', sm: 'auto' },
          whiteSpace: 'nowrap'
        }}
        onClick={onAddClick}
      >
        Add Allocation
      </Button>
    </Box>
  );
};

export default AssetAllocationHeader;
