import { useState, useEffect, useCallback } from 'react';
import { TenantOption, TenantProvider, useTenantListener, useTenantContext } from './TenantProvider';
import { getCorrelationId, getSessionId } from '@tumbaland/components';

// Re-export for convenience
export { TenantProvider, useTenantListener, useTenantContext, type TenantOption };

export interface UseTenantResult {
  selectedTenant: TenantOption | null;
  availableTenants: TenantOption[];
  loading: boolean;
  error: string | null;
  setSelectedTenant: (tenant: TenantOption) => void;
  refreshTenants: () => Promise<void>;
}

interface GroupApiResponse {
  success: boolean;
  data: Array<{
    _id: string;
    name: string;
    members: Array<{
      email: string;
      role: string;
    }>;
  }>;
}

const STORAGE_KEY = 'selectedTenant';

// Global cache to prevent multiple simultaneous requests across all hook instances
let globalGroupsFetchCache: Promise<TenantOption[]> | null = null;
let globalGroupsCacheTimestamp: number = 0;
let globalGroupsApiUrl: string = '';
let requestCounter = 0; // Debug counter
const CACHE_DURATION = 30000; // 30 seconds

// Global function to fetch groups - shared across all hook instances
const fetchGroupsGlobally = async (groupApiUrl: string): Promise<TenantOption[]> => {
  requestCounter++;
  console.log(`🔄 fetchGroupsGlobally called - Request #${requestCounter} for ${groupApiUrl}`);
  
  // Check if we have a valid cached request for the same API URL
  const now = Date.now();
  if (globalGroupsFetchCache && 
      globalGroupsApiUrl === groupApiUrl && 
      (now - globalGroupsCacheTimestamp) < CACHE_DURATION) {
    console.log(`✅ Using cached groups request for ${groupApiUrl}`);
    return globalGroupsFetchCache;
  }

  console.log(`🚀 Making new groups API request for ${groupApiUrl}`);

  // Create new request and cache it
  const fetchRequest = async (): Promise<TenantOption[]> => {
    try {
      // Check if groupApiUrl is provided
      if (!groupApiUrl) {
        console.warn('No GROUP_API_URL provided to useTenant hook');
        return [];
      }

      const headers = {
        'Content-Type': 'application/json',
        'x-correlation-id': getCorrelationId(),
        'x-session-id': getSessionId()
      };

      // Use user authentication for fetching groups; the httpOnly access_token
      // cookie is attached automatically by the browser.
      const response = await fetch(`${groupApiUrl}/api/groups/mine`, {
        method: 'GET',
        credentials: 'include',
        headers,
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      console.log(`Groups API response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch groups: ${response.status} ${response.statusText}`);
      }

      const data: GroupApiResponse = await response.json();
      
      if (!data.success) {
        throw new Error('API returned unsuccessful response');
      }

      // Transform groups to tenant options
      return data.data.map(group => ({
        id: group._id,
        name: group.name,
        type: 'group' as const
      }));
    } catch (err) {
      console.error('Error fetching user groups:', err);
      throw err;
    }
  };

  // Cache the request
  globalGroupsFetchCache = fetchRequest();
  globalGroupsCacheTimestamp = now;
  globalGroupsApiUrl = groupApiUrl;

  // Clear cache after request completes (success or failure)
  globalGroupsFetchCache.finally(() => {
    setTimeout(() => {
      if (globalGroupsFetchCache && (Date.now() - globalGroupsCacheTimestamp) >= CACHE_DURATION) {
        globalGroupsFetchCache = null;
        globalGroupsApiUrl = '';
      }
    }, CACHE_DURATION);
  });

  return globalGroupsFetchCache;
};

/**
 * Custom hook for managing tenant selection
 * Handles both personal account and group contexts
 */
export const useTenant = (
  groupApiUrl: string,
  userEmail?: string
): UseTenantResult => {
  const [selectedTenant, setSelectedTenantState] = useState<TenantOption | null>(null);
  const [availableTenants, setAvailableTenants] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load saved tenant selection from localStorage
  const loadSavedTenant = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const tenant = JSON.parse(saved) as TenantOption;
        return tenant;
      }
    } catch (err) {
      console.warn('Failed to load saved tenant selection:', err);
    }
    return null;
  }, []);

  // Save tenant selection to localStorage
  const saveTenant = useCallback((tenant: TenantOption) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tenant));
    } catch (err) {
      console.warn('Failed to save tenant selection:', err);
    }
  }, []);

  // Fetch available groups from API using user authentication
  const fetchGroups = useCallback(async (): Promise<TenantOption[]> => {
    return fetchGroupsGlobally(groupApiUrl);
  }, [groupApiUrl]);

  // Refresh tenants list
  const refreshTenants = useCallback(async () => {
    if (!userEmail) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Always include personal account
      const personalTenant: TenantOption = {
        id: 'personal',
        name: 'Personal',
        type: 'personal'
      };

      // Fetch groups
      const groupTenants = await fetchGroups();
      
      const allTenants = [personalTenant, ...groupTenants];
      setAvailableTenants(allTenants);

      // Set default selection if none exists
      const savedTenant = loadSavedTenant();
      if (savedTenant) {
        // Verify saved tenant still exists
        const tenantExists = allTenants.some(t => t.id === savedTenant.id);
        if (tenantExists) {
          setSelectedTenantState(savedTenant);
        } else {
          // Fallback to personal if saved tenant no longer exists
          setSelectedTenantState(personalTenant);
          saveTenant(personalTenant);
        }
      } else {
        // Default to personal account
        setSelectedTenantState(personalTenant);
        saveTenant(personalTenant);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load contexts';
      console.error('Error in refreshTenants:', err);
      setError(errorMessage);
      
      // Fallback to personal account only
      const personalTenant: TenantOption = {
        id: 'personal',
        name: 'Personal', 
        type: 'personal'
      };
      setAvailableTenants([personalTenant]);
      setSelectedTenantState(personalTenant);
    } finally {
      setLoading(false);
    }
  }, [userEmail, fetchGroups, loadSavedTenant, saveTenant]);

  // Set selected tenant with page reload
  const setSelectedTenant = useCallback((tenant: TenantOption) => {
    console.log(`🔄 Tenant changing to: ${tenant.type === 'personal' ? 'Personal' : tenant.name}`);
    
    // Save the new tenant selection
    saveTenant(tenant);
    
    // Reload the page to refresh all data with the new context
    console.log('🔄 Reloading page to apply new tenant context...');
    window.location.reload();
  }, [saveTenant]);

  // Initialize on mount and when user changes
  useEffect(() => {
    refreshTenants();
  }, [refreshTenants]);

  return {
    selectedTenant,
    availableTenants,
    loading,
    error,
    setSelectedTenant,
    refreshTenants
  };
};
