import { useCallback, useEffect, useState } from 'react';
import { logger } from '@tumbaland/frontend-core';
import { TrendsResult, getTrends } from '../services/statistics';

interface UseTrendsReturn {
  trends: TrendsResult | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * The two most recent windows for one scope. `windowDays` is a request
 * parameter rather than a client-side slice: the previous window reaches
 * further back than anything else on the dashboard fetches, so changing the
 * length has to go back to the server.
 */
export const useTrends = (windowDays: number, groupId?: string): UseTrendsReturn => {
  const [trends, setTrends] = useState<TrendsResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrends = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setTrends(await getTrends(windowDays, groupId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch trends');
      logger.error('Failed to fetch trends', err);
    } finally {
      setLoading(false);
    }
  }, [windowDays, groupId]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  return { trends, loading, error, refetch: fetchTrends };
};
