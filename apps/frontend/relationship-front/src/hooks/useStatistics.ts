import { useState, useEffect } from 'react';
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

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getStatistics(timeframe, groupId);
      setStatistics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch statistics');
      logger.error('Failed to fetch statistics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatistics();
  }, [timeframe, groupId]);

  // Set up refresh interval if provided
  useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
      const intervalId = setInterval(fetchStatistics, refreshInterval);
      return () => clearInterval(intervalId);
    }
  }, [refreshInterval, timeframe, groupId]);

  return {
    statistics,
    loading,
    error,
    refetch: fetchStatistics
  };
};
