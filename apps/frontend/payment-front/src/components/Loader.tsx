import { Box, CircularProgress, Typography } from '@mui/material';
import React from 'react';

export const Loader: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8 }}>
    <CircularProgress />
    <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>{message}</Typography>
  </Box>
);
