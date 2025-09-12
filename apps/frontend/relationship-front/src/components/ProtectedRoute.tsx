import React, { useEffect, useState } from 'react';
import { authService } from '../services/authService';
import { UnauthorizedPage, Loader } from '@tumbaland/components';

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
    return <Loader message="Checking authentication..." />;
  }

  if (!isAuthenticated) {
    return <UnauthorizedPage onLogin={() => authService.redirectToLogin()} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
