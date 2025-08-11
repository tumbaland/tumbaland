import { Box, Button, Typography } from '@mui/material';
import React from 'react';
import { authService } from '../services/authService';

const UnauthorizedPage: React.FC = () => {
  return (
    <Box sx={{ textAlign: 'center', mt: 8 }}>
      <Typography variant="h4" gutterBottom>Unauthorized</Typography>
      <Typography variant="body1" gutterBottom>You must be logged in to access this page.</Typography>
      <Button variant="contained" color="primary" onClick={() => authService.redirectToLogin()}>Go to Login</Button>
    </Box>
  );
};

export default UnauthorizedPage;
