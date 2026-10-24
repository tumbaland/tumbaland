import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@tumbaland/frontend-core';
import { RelationshipStatistics, getStatistics } from '../services/statistics';

interface UseStatisticsOptions {
  timeframe?: string;
  groupId?: string;
  refreshInterval?: number; // in milliseconds
}

interface UseStatisticsReturn {
  statistics: RelationshipStatistics | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useStatistics = (options: UseStatisticsOptions = {}): UseStatisticsReturn => {
  const { timeframe = 'all', groupId, refreshInterval } = options;

  const [statistics, setStatistics] = useState<RelationshipStatistics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Numbered, so an answer that arrives after a newer request was made is dropped.
  const latest = useRef(0);

  const fetchStatistics = useCallback(async () => {
    const request = ++latest.current;
    try {
      setLoading(true);
      setError(null);
      const data = await getStatistics(timeframe, groupId);
      if (request === latest.current) setStatistics(data);
    } catch (err) {
      if (request !== latest.current) return;
      setError(err instanceof Error ? err.message : 'Failed to fetch statistics');
      logger.error('Failed to fetch statistics', err);
    } finally {
      if (request === latest.current) setLoading(false);
    }
  }, [timeframe, groupId]);

  useEffect(() => {
    void fetchStatistics();
  }, [fetchStatistics]);

  // Set up refresh interval if provided
  useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
      const intervalId = setInterval(() => void fetchStatistics(), refreshInterval);
      return () => clearInterval(intervalId);
    }
  }, [refreshInterval, fetchStatistics]);

  return {
    statistics,
    loading,
    error,
    refetch: fetchStatistics
  };
};
