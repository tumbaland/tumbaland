import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity,
  CreateActivityRequest,
  UpdateActivityRequest,
  GetActivitiesFilters,
  ActivityStats
} from '../api/types';
import {
  createActivity as apiCreateActivity,
  getActivities as apiGetActivities,
  updateActivity as apiUpdateActivity,
  deleteActivity as apiDeleteActivity,
  getActivityStats as apiGetActivityStats,
  getRecentActivities as apiGetRecentActivities
} from '../api/activities';

export const useActivities = (filters?: GetActivitiesFilters) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  // Memoize filters to prevent infinite loop
  const memoizedFilters = useMemo(
    () => filters,
    [
      filters?.page,
      filters?.limit,
      filters?.activityType,
      filters?.startDate,
      filters?.endDate,
      filters?.sortBy,
      filters?.sortOrder,
      filters?.groupId
    ]
  );
  const loadActivities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGetActivities(memoizedFilters);
      console.log('Raw API data:', data);

      // Handle the ActivitiesResponse structure
      if (Array.isArray(data)) {
        console.log('Setting activities directly (array):', data);
        setActivities(data);
        setPagination((prev) => ({ ...prev, total: data.length }));
      } else {
        console.log('Setting activities from data.activities:', data.activities);
        setActivities(data.activities || []);
        if (data.pagination) {
          setPagination(data.pagination);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load activities');
    } finally {
      setLoading(false);
    }
  }, [memoizedFilters]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const createActivity = async (activityData: CreateActivityRequest): Promise<Activity | null> => {
    setError(null);
    try {
      const newActivity = await apiCreateActivity(activityData);
      setActivities((prev) => [newActivity, ...prev]);
      return newActivity;
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to create activity');
      return null;
    }
  };

  const updateActivity = async (id: string, updateData: UpdateActivityRequest): Promise<Activity | null> => {
    setError(null);
    try {
      const updatedActivity = await apiUpdateActivity(id, updateData);
      setActivities((prev) =>
        prev.map((activity) => ((activity._id || activity.id) === id ? updatedActivity : activity))
      );
      return updatedActivity;
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to update activity');
      return null;
    }
  };

  const deleteActivity = async (id: string): Promise<boolean> => {
    setError(null);
    try {
      await apiDeleteActivity(id);
      setActivities((prev) => prev.filter((activity) => (activity._id || activity.id) !== id));
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to delete activity');
      return false;
    }
  };

  const refetch = () => {
    loadActivities();
  };
  return {
    activities,
    loading,
    error,
    pagination,
    createActivity,
    updateActivity,
    deleteActivity,
    refetch
  };
};

export const useActivityStats = (filters?: { startDate?: Date | string; endDate?: Date | string }) => {
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGetActivityStats(filters);
      setStats(data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return { stats, loading, error, refetch: loadStats };
};

export const useRecentActivities = (limit: number = 10) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadRecentActivities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGetRecentActivities(limit);
      setActivities(data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load recent activities');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    loadRecentActivities();
  }, [loadRecentActivities]);

  return { activities, loading, error, refetch: loadRecentActivities };
};
