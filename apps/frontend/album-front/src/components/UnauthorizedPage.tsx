import React from 'react';
import { Box, Typography, Button, Container, Paper } from '@mui/material';
import { Lock, Login } from '@mui/icons-material';
import { authService } from '../services/authService';

const UnauthorizedPage: React.FC = () => {
  const handleLogin = () => {
    authService.redirectToLogin();
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
        <Lock sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
        
        <Typography variant="h4" component="h1" gutterBottom color="primary">
          Access Restricted
        </Typography>
        
        <Typography variant="body1" color="text.secondary" paragraph>
          You need to be logged in to access the Album Manager. 
          Please sign in with your Google account to continue.
        </Typography>
        
        <Box sx={{ mt: 4 }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<Login />}
            onClick={handleLogin}
            sx={{ px: 4, py: 1.5 }}
          >
            Sign In to Continue
          </Button>
        </Box>
        
        <Typography variant="caption" color="text.secondary" sx={{ mt: 3, display: 'block' }}>
          🎵 Secure access to your music collection
        </Typography>
      </Paper>
    </Container>
  );
};

export default UnauthorizedPage;
