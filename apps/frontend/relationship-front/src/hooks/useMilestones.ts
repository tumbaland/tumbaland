import { useCallback, useEffect, useState } from 'react';
import { logger } from '@tumbaland/frontend-core';
import { MilestonesResult, getMilestones } from '../services/statistics';

interface UseMilestonesReturn {
  milestones: MilestonesResult | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Milestones just reached and coming up for one scope. Like `useStreaks` there
 * is no timeframe: a total is a total, and the endpoint answers against the
 * whole history.
 */
export const useMilestones = (groupId?: string): UseMilestonesReturn => {
  const [milestones, setMilestones] = useState<MilestonesResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMilestones = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setMilestones(await getMilestones(groupId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch milestones');
      logger.error('Failed to fetch milestones', err);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchMilestones();
  }, [fetchMilestones]);

  return { milestones, loading, error, refetch: fetchMilestones };
};
