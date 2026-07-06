import { useCallback, useEffect, useState } from 'react';
import { logger } from '@tumbaland/frontend-core';
import { DashboardSettingsData, getDashboardSettings, saveDashboardSettings } from '../api/dashboardSettings';
import { getActivityTypes } from '../api/activityTypes';
import { ActivityType } from '../api/types';

const EMPTY_SETTINGS: DashboardSettingsData = { highlightTypeIds: [], hiddenTypeIds: [] };

/**
 * Dashboard configuration + the activity types it refers to, for the current
 * tenant scope. Settings are stored server-side (shared per group), so both
 * partners see the same dashboard.
 */
export const useDashboardSettings = (groupId?: string) => {
  const [settings, setSettings] = useState<DashboardSettingsData>(EMPTY_SETTINGS);
  const [types, setTypes] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getDashboardSettings(groupId), getActivityTypes({ groupId })])
      .then(([settingsData, typesResponse]) => {
        if (cancelled) return;
        setSettings(settingsData);
        setTypes(typesResponse.data);
      })
      .catch((e) => {
        logger.error('Failed to load dashboard settings', e);
        if (!cancelled) setSettings(EMPTY_SETTINGS);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const save = useCallback(
    async (next: DashboardSettingsData) => {
      setSettings(next); // optimistic
      try {
        const stored = await saveDashboardSettings(next, groupId);
        setSettings(stored);
      } catch (e) {
        logger.error('Failed to save dashboard settings', e);
        throw e;
      }
    },
    [groupId]
  );

  return { settings, types, loading, save };
};

export type UseDashboardSettings = ReturnType<typeof useDashboardSettings>;
