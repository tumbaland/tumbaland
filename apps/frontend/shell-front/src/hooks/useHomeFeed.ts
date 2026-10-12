import { useCallback, useEffect, useState } from 'react';
import { logger, useTenantFilter } from '@tumbaland/frontend-core';
import {
  getMemories,
  getMilestones,
  getRecentActivities,
  getRecentPhotos,
  getUpcomingPlans,
  type HomePhoto,
  type HomePlan,
  type Memories,
  type Milestones,
  type RecentActivity
} from '../services/homeApi';
import { getGlobalConfig } from '../config/ConfigProvider';

export interface HomeFeed {
  memories: Memories | null;
  photos: HomePhoto[];
  activities: RecentActivity[];
  milestones: Milestones | null;
  plans: HomePlan[];
  loading: boolean;
}

/**
 * The four things the home page shows of the data itself.
 *
 * Settled independently: a home page that shows nothing until the slowest of
 * three calls returns is a home page nobody waits for. Each section renders as
 * soon as its own call lands, and a section whose call fails simply does not
 * appear — none of this is worth an error message on the first screen of the
 * app, and the module it came from is one tap away either way.
 */
export function useHomeFeed(): HomeFeed {
  const groupId = useTenantFilter();
  const [memories, setMemories] = useState<Memories | null>(null);
  const [photos, setPhotos] = useState<HomePhoto[]>([]);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [milestones, setMilestones] = useState<Milestones | null>(null);
  const [plans, setPlans] = useState<HomePlan[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { ALBUM_API_URL, RELATIONSHIP_API_URL } = getGlobalConfig();
    setLoading(true);

    const settle = <T>(promise: Promise<T>, onDone: (value: T) => void, what: string) =>
      promise.then(onDone).catch((err) => logger.warn(`Home page could not load ${what}`, { error: err }));

    await Promise.all([
      ALBUM_API_URL ? settle(getMemories(groupId), setMemories, 'memories') : Promise.resolve(),
      ALBUM_API_URL ? settle(getRecentPhotos(groupId), setPhotos, 'recent photos') : Promise.resolve(),
      RELATIONSHIP_API_URL ? settle(getRecentActivities(groupId), setActivities, 'recent entries') : Promise.resolve(),
      RELATIONSHIP_API_URL ? settle(getMilestones(groupId), setMilestones, 'milestones') : Promise.resolve(),
      RELATIONSHIP_API_URL ? settle(getUpcomingPlans(groupId), setPlans, 'plans') : Promise.resolve()
    ]);

    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  return { memories, photos, activities, milestones, plans, loading };
}
