import React, { useEffect, useState } from 'react';
import type { AuthService } from '../../authService';
import { logger } from '../../monitoring';
import type { User } from '../../types';
import { TenantSelector, useTenant } from '../tenant';
import { AuthHeader, type AuthHeaderNavigationItem } from './AuthHeader';

export interface StandaloneAuthHeaderProps {
  authService: Pick<AuthService, 'checkAuth' | 'logout' | 'redirectToLogin'>;
  navigationItems: AuthHeaderNavigationItem[];
  /** Without it the group picker has nothing to ask, and only the personal account shows. */
  groupApiUrl?: string;
  shellFrontUrl?: string;
}

/**
 * The header an app draws when it runs on its own origin rather than inside
 * the shell: it finds out who is signed in by asking auth-service, and offers
 * the app's own sections and the group picker.
 *
 * What album-front and relationship-front each carried a copy of. An app that
 * keeps its auth state somewhere else (finance-front reads it through React
 * Query) builds on `AuthHeader` directly instead.
 */
export const StandaloneAuthHeader: React.FC<StandaloneAuthHeaderProps> = ({
  authService,
  navigationItems,
  groupApiUrl,
  shellFrontUrl
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const {
    selectedTenant,
    availableTenants,
    loading: tenantsLoading,
    error: tenantsError,
    setSelectedTenant
  } = useTenant(groupApiUrl || '', isAuthenticated && groupApiUrl ? user?.id : undefined);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { authenticated, user } = await authService.checkAuth();
        setIsAuthenticated(authenticated);
        setUser(user);
      } catch (error) {
        logger.error('Auth check failed', error);
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    void checkAuth();
  }, [authService]);

  return (
    <AuthHeader
      isLoading={isLoading}
      isAuthenticated={isAuthenticated}
      user={user}
      onLogin={() => authService.redirectToLogin()}
      // The logout service refreshes the page, so there is no state to update.
      onLogout={async () => {
        await authService.logout();
      }}
      navigationItems={navigationItems}
      shellFrontUrl={shellFrontUrl}
      TenantSelectorComponent={TenantSelector}
      selectedTenant={selectedTenant}
      availableTenants={availableTenants}
      tenantsLoading={tenantsLoading}
      tenantsError={tenantsError}
      onTenantChange={setSelectedTenant}
    />
  );
};
