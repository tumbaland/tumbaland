import { logger } from '@tumbaland/components';
import { TenantOption } from './TenantSelector';

/**
 * Hook to get current tenant ID for data filtering
 * Returns the groupId to be used in API calls, or undefined for personal context
 * Since we reload the page when tenant changes, this can be a simple read from localStorage
 */
export const useTenantFilter = (): string | undefined => {
  const selectedTenant = getTenantFromStorage();
  
  // Return groupId for group context, undefined for personal context
  return selectedTenant?.type === 'group' ? selectedTenant.id : undefined;
};

/**
 * Utility to get current tenant from localStorage
 * Used for getting tenant context without triggering re-renders
 */
const getTenantFromStorage = (): TenantOption | null => {
  try {
    const saved = localStorage.getItem('selectedTenant');
    if (saved) {
      return JSON.parse(saved) as TenantOption;
    }
  } catch (err) {
    logger.warn('Failed to load tenant from storage', { error: err });
  }
  return null;
};
