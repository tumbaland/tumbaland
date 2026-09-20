import { useState, useEffect, useCallback } from 'react';
import { TenantOption, TenantProvider, useTenantListener, useTenantContext } from './TenantProvider';
import { getCorrelationId, getSessionId, logger } from '../../monitoring';
import { TENANT_STORAGE_KEY } from '../../sessionStorage';

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

// Owned here, but declared in frontend-core so `logout()` can clear it — see
// the note on session-scoped storage there.
const STORAGE_KEY = TENANT_STORAGE_KEY;

/**
 * Which context each account last worked in, keyed by user id.
 *
 * Deliberately *not* in SESSION_SCOPED_KEYS: `logout()` clears the active
 * selection above, which is right — `useTenantFilter` reads that key
 * synchronously with no idea who is signed in, so leaving a group id there
 * across a sign-out is what sent the next account's requests out with a
 * groupId it is not a member of. This is the other half: a preference, per
 * account, that survives a sign-out so signing back in returns you to the
 * group you were working in rather than dropping you on Personal every time.
 *
 * Keyed by email rather than stamped with one, so a second account signing in
 * on the same browser reads its own entry or none, never someone else's.
 */
const LAST_TENANT_KEY = 'lastTenantByUser';

type LastTenantMap = Record<string, TenantOption>;

const readLastTenants = (): LastTenantMap => {
  try {
    const raw = localStorage.getItem(LAST_TENANT_KEY);
    return raw ? (JSON.parse(raw) as LastTenantMap) : {};
  } catch (err) {
    logger.warn('Failed to read the last tenant per account', { error: err });
    return {};
  }
};

/** The context this account was last in, or null for an account with no history. */
const loadLastTenant = (userId?: string): TenantOption | null => {
  if (!userId) return null;
  return readLastTenants()[userId] ?? null;
};

const rememberLastTenant = (tenant: TenantOption, userId?: string): void => {
  if (!userId) return;
  try {
    localStorage.setItem(LAST_TENANT_KEY, JSON.stringify({ ...readLastTenants(), [userId]: tenant }));
  } catch (err) {
    logger.warn('Failed to remember the last tenant', { error: err });
  }
};

/**
 * The persisted selection, stamped with the account that made it.
 *
 * localStorage is per-origin, not per-account: sign out and sign in as
 * someone else in the same browser and the previous account's selection is
 * still sitting there. `useTenantFilter` reads it synchronously on first
 * render, so every group-scoped request in the app goes out with a groupId
 * the new account is not a member of, and the service answers 403 (which is
 * exactly what it should do). The stamp lets us recognize a selection that
 * belongs to someone else and drop it.
 *
 * The id, not the address: an email is a mutable attribute of an account, so
 * a change of address would orphan the stamp and make the account's own
 * selection read as somebody else's. A selection written by an older build
 * carries `userEmail` and no `userId`; it reads as unstamped and is validated
 * by group membership alone, exactly as anything written before stamping
 * existed, and picks up an id the first time this account saves.
 */
interface StoredTenant extends TenantOption {
  userId?: string;
}

/** The stamp is storage bookkeeping; consumers see a plain TenantOption. */
const toOption = ({ id, name, type }: StoredTenant): TenantOption => ({ id, name, type });

// Global cache to prevent multiple simultaneous requests across all hook instances
let globalGroupsFetchCache: Promise<TenantOption[]> | null = null;
let globalGroupsCacheTimestamp: number = 0;
let globalGroupsCacheKey: string = '';
let requestCounter = 0; // Debug counter
const CACHE_DURATION = 30000; // 30 seconds

// Global function to fetch groups - shared across all hook instances. Keyed by
// user as well as URL: the cache outlives a sign-out, and handing the incoming
// account the previous one's group list is how a stale selection gets
// "validated" and survives.
const fetchGroupsGlobally = async (groupApiUrl: string, userId?: string): Promise<TenantOption[]> => {
  requestCounter++;
  logger.debug('fetchGroupsGlobally called', { requestNumber: requestCounter, groupApiUrl });

  // Check if we have a valid cached request for the same API URL and user
  const now = Date.now();
  const cacheKey = `${userId ?? ''}|${groupApiUrl}`;
  if (
    globalGroupsFetchCache &&
    globalGroupsCacheKey === cacheKey &&
    now - globalGroupsCacheTimestamp < CACHE_DURATION
  ) {
    logger.debug('Using cached groups request', { groupApiUrl });
    return globalGroupsFetchCache;
  }

  logger.debug('Making new groups API request', { groupApiUrl });

  // Create new request and cache it
  const fetchRequest = async (): Promise<TenantOption[]> => {
    try {
      // Check if groupApiUrl is provided
      if (!groupApiUrl) {
        logger.warn('No GROUP_API_URL provided to useTenant hook');
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

      logger.debug('Groups API response', { status: response.status, statusText: response.statusText });

      if (!response.ok) {
        throw new Error(`Failed to fetch groups: ${response.status} ${response.statusText}`);
      }

      const data: GroupApiResponse = await response.json();

      if (!data.success) {
        throw new Error('API returned unsuccessful response');
      }

      // Transform groups to tenant options
      return data.data.map((group) => ({
        id: group._id,
        name: group.name,
        type: 'group' as const
      }));
    } catch (err) {
      logger.error('Error fetching user groups', err);
      throw err;
    }
  };

  // Cache the request
  globalGroupsFetchCache = fetchRequest();
  globalGroupsCacheTimestamp = now;
  globalGroupsCacheKey = cacheKey;

  // Clear cache after request completes (success or failure). `.finally()`
  // returns a new derived promise that rejects if the request did — nothing
  // else observes that derived promise (callers only await the original
  // `globalGroupsFetchCache` reference returned below), so without a no-op
  // `.catch()` here a failed request logs as an unhandled rejection.
  globalGroupsFetchCache
    .finally(() => {
      setTimeout(() => {
        if (globalGroupsFetchCache && Date.now() - globalGroupsCacheTimestamp >= CACHE_DURATION) {
          globalGroupsFetchCache = null;
          globalGroupsCacheKey = '';
        }
      }, CACHE_DURATION);
    })
    .catch(() => {});

  return globalGroupsFetchCache;
};

/**
 * Custom hook for managing tenant selection
 * Handles both personal account and group contexts
 */
export const useTenant = (groupApiUrl: string, userId?: string): UseTenantResult => {
  const [selectedTenant, setSelectedTenantState] = useState<TenantOption | null>(null);
  const [availableTenants, setAvailableTenants] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load saved tenant selection from localStorage
  const loadSavedTenant = useCallback((): StoredTenant | null => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const tenant = JSON.parse(saved) as StoredTenant;
        return tenant;
      }
    } catch (err) {
      logger.warn('Failed to load saved tenant selection', { error: err });
    }
    return null;
  }, []);

  // Save tenant selection to localStorage, stamped with the current account
  const saveTenant = useCallback(
    (tenant: TenantOption) => {
      try {
        const stored: StoredTenant = { ...tenant, userId };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      } catch (err) {
        logger.warn('Failed to save tenant selection', { error: err });
      }
      // Outlives the sign-out that clears the line above.
      rememberLastTenant(tenant, userId);
    },
    [userId]
  );

  // Fetch available groups from API using user authentication
  const fetchGroups = useCallback(async (): Promise<TenantOption[]> => {
    return fetchGroupsGlobally(groupApiUrl, userId);
  }, [groupApiUrl, userId]);

  // Refresh tenants list
  const refreshTenants = useCallback(async () => {
    if (!userId) {
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
      // A selection made by a different account is not ours to keep, even if
      // this account happens to belong to that group too — an unstamped one
      // predates this check and is validated by membership alone.
      const belongsToThisUser = !savedTenant?.userId || savedTenant.userId === userId;
      const stillAMember = allTenants.some((t) => t.id === savedTenant?.id);

      if (savedTenant && belongsToThisUser && stillAMember) {
        setSelectedTenantState(toOption(savedTenant));
      } else {
        // No active selection this account can use. Before falling back to
        // Personal, see where this account was last working: a sign-out clears
        // the active key, and without this every sign-in landed on Personal
        // however long you had been in a group.
        const lastUsed = loadLastTenant(userId);
        const restorable =
          lastUsed && lastUsed.type === 'group' && allTenants.some((tenant) => tenant.id === lastUsed.id)
            ? lastUsed
            : null;
        const next = restorable ?? personalTenant;

        setSelectedTenantState(next);
        saveTenant(next);

        // Sibling components read the raw storage value synchronously on mount
        // (useTenantFilter), so by now they have already fired their requests
        // against whatever storage said a moment ago — the discarded groupId,
        // or nothing at all where we have just restored one. Reload for the
        // same reason switching tenant by hand reloads: it is the only way
        // this app re-reads the context. Storage now agrees with state, so the
        // next pass takes the branch above and this does not loop.
        if (restorable) {
          logger.debug('Restored the context this account last used', { name: restorable.name });
          window.location.reload();
        } else if (savedTenant?.type === 'group') {
          logger.debug('Discarded a tenant selection this account cannot use; reloading');
          window.location.reload();
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load contexts';
      logger.error('Error in refreshTenants', err);
      setError(errorMessage);

      // The groups call failed, so we cannot tell a stale selection from a
      // valid one. Keep showing what storage says rather than claiming
      // "Personal" while useTenantFilter keeps sending the saved groupId —
      // that mismatch is what made the UI look like it had switched context
      // when it had not. TenantSelector renders the error state instead.
      const personalTenant: TenantOption = {
        id: 'personal',
        name: 'Personal',
        type: 'personal'
      };
      setAvailableTenants([personalTenant]);
      const savedTenant = loadSavedTenant();
      setSelectedTenantState(savedTenant ? toOption(savedTenant) : personalTenant);
    } finally {
      setLoading(false);
    }
  }, [userId, fetchGroups, loadSavedTenant, saveTenant]);

  // Set selected tenant with page reload
  const setSelectedTenant = useCallback(
    (tenant: TenantOption) => {
      logger.debug('Tenant changing', { to: tenant.type === 'personal' ? 'Personal' : tenant.name });

      // Save the new tenant selection
      saveTenant(tenant);

      // Reload the page to refresh all data with the new context
      logger.debug('Reloading page to apply new tenant context');
      window.location.reload();
    },
    [saveTenant]
  );

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
