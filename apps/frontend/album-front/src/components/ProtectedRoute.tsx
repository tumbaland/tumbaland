import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { authService } from '../services/authService';
import UnauthorizedPage from './UnauthorizedPage';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
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

  if (isLoading) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          backgroundColor: '#f5f5f5'
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
    return <UnauthorizedPage />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
