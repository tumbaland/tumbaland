import { useState, useEffect, useMemo } from 'react';
import { Activity, ActivitySummary } from '../types/Activity';
import { activityService } from '../services/activityService';

export const useActivities = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await activityService.fetchActivities();
      setActivities(response.data.activities);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while fetching activities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  const activitySummary: ActivitySummary = useMemo(() => {
    if (activities.length === 0) {
      return {
        totalActivities: 0,
        totalHours: 0,
        averageHoursPerActivity: 0,
        mostFrequentActivityType: '',
        activitiesByType: {}
      };
    }

    const totalHours = activities.reduce((sum, activity) => sum + activity.hours, 0);
    const activitiesByType = activities.reduce((acc, activity) => {
      acc[activity.activity.type] = (acc[activity.activity.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostFrequentActivityType = Object.entries(activitiesByType)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || '';

    return {
      totalActivities: activities.length,
      totalHours,
      averageHoursPerActivity: Math.round((totalHours / activities.length) * 10) / 10,
      mostFrequentActivityType,
      activitiesByType
    };
  }, [activities]);

  return {
    activities,
    loading,
    error,
    fetchActivities,
    activitySummary
  };
};
