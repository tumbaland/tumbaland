import { useState, useEffect } from 'react';
import { RelationshipStatistics, getStatistics } from '../api/statistics';

interface UseStatisticsOptions {
  timeframe?: string;
  refreshInterval?: number; // in milliseconds
}

interface UseStatisticsReturn {
  statistics: RelationshipStatistics | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useStatistics = (options: UseStatisticsOptions = {}): UseStatisticsReturn => {
  const { timeframe = 'all', refreshInterval } = options;
  
  const [statistics, setStatistics] = useState<RelationshipStatistics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getStatistics(timeframe);
      setStatistics(data);
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to fetch statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatistics();
  }, [timeframe]);

  // Set up refresh interval if provided
  useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
      const intervalId = setInterval(fetchStatistics, refreshInterval);
      return () => clearInterval(intervalId);
    }
  }, [refreshInterval, timeframe]);

  return {
    statistics,
    loading,
    error,
    refetch: fetchStatistics,
  };
};
