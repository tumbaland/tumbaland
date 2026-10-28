import React from 'react';
import { Box, Typography } from '@mui/material';

interface TickerPriceSummaryProps {
  count: number;
  maxPrice: number;
  minPrice: number;
}

/** How many prices are in range, and the highest and lowest close. */
export const TickerPriceSummary: React.FC<TickerPriceSummaryProps> = ({ count, maxPrice, minPrice }) => (
  <Box
    sx={{
      mt: 2,
      display: 'flex',
      flexDirection: { xs: 'row', sm: 'row' },
      justifyContent: 'space-around',
      pt: 2,
      borderTop: '1px solid var(--mui-palette-divider)',
      gap: { xs: 2, sm: 0 }
    }}
  >
    <Box sx={{ textAlign: 'center', mb: { xs: 1, sm: 0 } }}>
      <Typography variant="h6" color="primary" sx={{ fontSize: { xs: 16, sm: 20 } }}>
        {count}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary'
        }}
      >
        Data Points
      </Typography>
    </Box>
    <Box sx={{ textAlign: 'center', mb: { xs: 1, sm: 0 } }}>
      <Typography variant="h6" color="primary" sx={{ fontSize: { xs: 16, sm: 20 } }}>
        {maxPrice.toFixed(2)}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary'
        }}
      >
        Max Close
      </Typography>
    </Box>
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="h6" color="primary" sx={{ fontSize: { xs: 16, sm: 20 } }}>
        {minPrice.toFixed(2)}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary'
        }}
      >
        Min Close
      </Typography>
    </Box>
  </Box>
);
