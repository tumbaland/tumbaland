import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography, Container, Paper, Button } from '@mui/material';
import { Lock, Login } from '@mui/icons-material';
import { authService } from '../services/authService';

interface ProtectedContentProps {
  children: React.ReactNode;
  showHeader?: boolean;
}

const ProtectedContent: React.FC<ProtectedContentProps> = ({ children, showHeader = false }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { authenticated } = await authService.checkAuth();
        setIsAuthenticated(authenticated);
      } catch (error) {
        console.error('Auth check failed:', error);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogin = () => {
    authService.redirectToLogin();
  };

  if (isLoading) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'center', 
          alignItems: 'center', 
          height: showHeader ? '60vh' : '100vh',
          backgroundColor: showHeader ? 'transparent' : '#f5f5f5'
        }}
      >
        <CircularProgress size={48} />
        <Typography variant="body1" sx={{ mt: 2, color: 'text.secondary' }}>
          Checking authentication...
        </Typography>
      </Box>
    );
  }

  if (!isAuthenticated) {
    return (
      <Container maxWidth="sm" sx={{ mt: showHeader ? 4 : 8 }}>
        <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
          <Lock sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
          
          <Typography variant="h4" component="h1" gutterBottom color="primary">
            Authentication Required
          </Typography>
          
          <Typography variant="body1" color="text.secondary" paragraph>
            Please sign in with your Google account to access this content.
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
        </Paper>
      </Container>
    );
  }

  return <>{children}</>;
};

export default ProtectedContent;
