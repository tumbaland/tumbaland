import React from 'react';
import { AuthHeader as SharedAuthHeader, TenantSelector, useTenant } from '@tumbaland/components';
import { authService } from '../services/authService';
import { navigationItems } from '../config/navigation';
import { useConfig } from '../hooks/useConfig';
import { useCurrentUser, useLogout } from '../hooks/useAuth';

const AuthHeader: React.FC = () => {
  const config = useConfig();

  // Auth state is fetched via React Query here (unlike relationship-front/album-front's plain
  // useEffect), so it stays in this wrapper rather than being pulled into the shared component.
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const logoutMutation = useLogout();

  const isAuthenticated = !!user;

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

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    // The logout mutation will clear the cache and redirect
  };

  return (
    <SharedAuthHeader
      isLoading={userLoading}
      isAuthenticated={isAuthenticated}
      user={user ?? null}
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
