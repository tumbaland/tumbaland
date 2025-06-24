/**
 * Frontend Auth Utilities for Tumbaland Apps
 * This can be shared across all frontend applications
 */
import React from 'react';

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

export class AuthService {
  private authServiceUrl: string;
  private authFrontUrl: string;

  constructor(
    authServiceUrl = 'http://localhost:5001',
    authFrontUrl = 'http://localhost:3004'
  ) {
    this.authServiceUrl = authServiceUrl;
    this.authFrontUrl = authFrontUrl;
  }

  /**
   * Check if user is authenticated
   */
  async checkAuth(): Promise<{ authenticated: boolean; user: User | null }> {
    try {
      const response = await fetch(`${this.authServiceUrl}/auth/verify`, {
        credentials: 'include',
      });

      const data = await response.json();
      return {
        authenticated: data.success && data.authenticated,
        user: data.user || null,
      };
    } catch (error) {
      console.error('Auth check failed:', error);
      return { authenticated: false, user: null };
    }
  }

  /**
   * Get user profile
   */
  async getProfile(): Promise<User | null> {
    try {
      const response = await fetch(`${this.authServiceUrl}/auth/profile`, {
        credentials: 'include',
      });

      const data = await response.json();
      return data.success ? data.user : null;
    } catch (error) {
      console.error('Failed to get profile:', error);
      return null;
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<boolean> {
    try {
      const response = await fetch(`${this.authServiceUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });

      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('Logout failed:', error);
      return false;
    }
  }

  /**
   * Redirect to login page
   */
  redirectToLogin(returnUrl?: string): void {
    const currentUrl = returnUrl || window.location.href;
    const loginUrl = `${this.authFrontUrl}?redirect_uri=${encodeURIComponent(currentUrl)}`;
    window.location.href = loginUrl;
  }

  /**
   * Require authentication - redirect to login if not authenticated
   */
  async requireAuth(): Promise<User | null> {
    const { authenticated, user } = await this.checkAuth();
    
    if (!authenticated) {
      this.redirectToLogin();
      return null;
    }
    
    return user;
  }
}

// Create a default instance
export const authService = new AuthService();

// React Hook for authentication
export const useAuth = () => {
  const [authState, setAuthState] = React.useState<AuthState>({
    isAuthenticated: false,
    user: null,
    isLoading: true,
    error: null,
  });

  React.useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const { authenticated, user } = await authService.checkAuth();
        setAuthState({
          isAuthenticated: authenticated,
          user,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        setAuthState({
          isAuthenticated: false,
          user: null,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Auth check failed',
        });
      }
    };

    checkAuthStatus();
  }, []);

  const login = () => authService.redirectToLogin();
  
  const logout = async () => {
    const success = await authService.logout();
    if (success) {
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null,
      });
    }
    return success;
  };

  return {
    ...authState,
    login,
    logout,
  };
};

// Higher-order component for protected routes
export const withAuth = <P extends object>(
  Component: React.ComponentType<P>
): React.FC<P> => {
  return (props: P) => {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
      return React.createElement('div', null, 'Loading...');
    }

    if (!isAuthenticated) {
      authService.redirectToLogin();
      return React.createElement('div', null, 'Redirecting to login...');
    }

    return React.createElement(Component, props);
  };
};
