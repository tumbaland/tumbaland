import { useCallback, useEffect, useState } from 'react';
import { logger } from '@tumbaland/frontend-core';
import { StreakStatistics, getStreaks } from '../services/statistics';

interface UseStreaksReturn {
  streaks: StreakStatistics | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Logging streaks and per-type staleness for one scope. Unlike `useStatistics`
 * there is no timeframe: the endpoint always answers against the full history.
 */
export const useStreaks = (groupId?: string): UseStreaksReturn => {
  const [streaks, setStreaks] = useState<StreakStatistics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStreaks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setStreaks(await getStreaks(groupId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch streaks');
      logger.error('Failed to fetch streaks', err);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    void fetchStreaks();
  }, [fetchStreaks]);

  return { streaks, loading, error, refetch: fetchStreaks };
};
