import React, { useEffect, useState } from 'react';
import { AuthHeader as SharedAuthHeader, TenantSelector, logger, useTenant } from '@tumbaland/frontend-core';
import { authService } from '../services/authService';
import { User } from '../types';
import { navigationItems } from '../config/navigation';
import { useConfig } from '../config/ConfigProvider';

// No caller passes props to <AuthHeader /> today (checked all usages), so this wrapper always
// resolves auth state itself via authService rather than accepting overrides.
const AuthHeader: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const config = useConfig();

  const {
    selectedTenant,
    availableTenants,
    loading: tenantsLoading,
    error: tenantsError,
    setSelectedTenant
  } = useTenant(
    config.GROUP_API_URL || '',
    isAuthenticated && config.GROUP_API_URL ? user?.email : undefined
  );

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { authenticated, user } = await authService.checkAuth();
        setIsAuthenticated(authenticated);
        setUser(user);
      } catch (error) {
        logger.error('Auth check failed', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogout = async () => {
    await authService.logout();
    // The logout service will refresh the page, so no need to update state
  };

  return (
    <SharedAuthHeader
      isLoading={isLoading}
      isAuthenticated={isAuthenticated}
      user={user}
      onLogin={() => authService.redirectToLogin()}
      onLogout={handleLogout}
      navigationItems={navigationItems}
      shellFrontUrl={config.SHELL_FRONT_URL}
      TenantSelectorComponent={TenantSelector}
      selectedTenant={selectedTenant}
      availableTenants={availableTenants}
      tenantsLoading={tenantsLoading}
      tenantsError={tenantsError}
      onTenantChange={setSelectedTenant}
    />
  );
};

export default AuthHeader;
