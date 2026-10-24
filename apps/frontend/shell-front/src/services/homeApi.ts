import { createApiClient } from '@tumbaland/frontend-core';
import { getGlobalConfig } from '../config/ConfigProvider';

/**
 * What the home page shows of the data itself, rather than links to it.
 *
 * No `onUnauthorized` on either client, for the same reason the plan card has
 * none: the home page is behind the session gate already, and a panel of
 * photos is the last thing that should be allowed to bounce anyone to the
 * login screen. A failed call hides its section.
 */
const albumApi = createApiClient({ baseUrl: () => getGlobalConfig().ALBUM_API_URL ?? '' });
const journalApi = createApiClient({ baseUrl: () => getGlobalConfig().RELATIONSHIP_API_URL ?? '' });

/** The envelope every Tumbaland service answers in. */
interface Envelope<T> {
  success: boolean;
  data: T;
}

export interface HomePhoto {
  _id: string;
  title?: string;
  originalName: string;
  albumId: string;
  /** A video is drawn as its first frame; its "thumbnail" link is the video itself. */
  mimetype?: string;
  /** Signed, and short-lived: never cache one past the render it was fetched for. */
  signedUrl?: string;
  thumbnailSignedUrl?: string;
  createdAt: string;
}

export interface MemoryYear {
  year: number;
  yearsAgo: number;
  /** How many this year has in the window, which may exceed `photos.length`. */
  photoCount: number;
  photos: Array<HomePhoto & { albumName: string; memoryDate: string }>;
}

export interface Memories {
  date: string;
  totalPhotos: number;
  /** Most recent year first. */
  years: MemoryYear[];
}

export interface RecentActivity {
  _id: string;
  date: string;
  description?: string;
  hours?: number;
  location?: { name?: string };
  /** Populated by the service, so the entry knows what kind of thing it was. */
  typeId?: { _id: string; name: string; color?: string; icon?: string };
}

/** A copy of the relationship dashboard's milestone shape; change both together. */
export interface Milestone {
  key: string;
  label: string;
  /** The number it is counting to, and for a count milestone how many more it takes. */
  target: number;
  remaining?: number;
  color?: string;
  /** Reached: the day it happened, and how long ago. */
  achievedOn?: string;
  daysAgo?: number;
  /** Upcoming: the day it falls on, or is projected to. */
  expectedOn?: string;
  daysAway?: number;
  projected?: boolean;
}

export interface Milestones {
  since: string | null;
  daysTogether: number | null;
  recent: Milestone[];
  upcoming: Milestone[];
}

/** A plan from the journal; the fields the home page shows. */
export interface HomePlan {
  id: string;
  title: string;
  /** YYYY-MM-DD, the first day */
  date: string;
  /** YYYY-MM-DD, the last day of a trip */
  endDate: string | null;
  /** HH:mm, null all day */
  time: string | null;
  location: { label: string } | null;
  type?: { color?: string };
}

/** Whichever context the session is reading, as every scoped endpoint spells it. */
const scope = (groupId?: string) => (groupId ? { groupId } : undefined);

/** Photos from this same date in earlier years. Empty on a day with no history. */
export const getMemories = async (groupId?: string): Promise<Memories> => {
  const { data } = await albumApi.get<Envelope<Memories>>('/api/photos/memories', {
    params: { ...scope(groupId), limitPerYear: 6 }
  });
  return data;
};

export const getRecentPhotos = async (groupId?: string, limit = 8): Promise<HomePhoto[]> => {
  const { data } = await albumApi.get<Envelope<{ photos: HomePhoto[] }>>('/api/photos/recent', {
    params: { ...scope(groupId), limit }
  });
  return data.photos ?? [];
};

export const getRecentActivities = async (groupId?: string, limit = 20): Promise<RecentActivity[]> => {
  // Scoped like the photo calls. Without a groupId the service answers with
  // the caller's *personal* entries alone, so a shared journal came back empty
  // however much was in it.
  //
  // Asks for more than the home page shows. The endpoint takes a count, not a
  // date range, and the page wants a week — so the week is cut here, from a
  // batch big enough that a busy one is not truncated before it is measured.
  const { data } = await journalApi.get<Envelope<RecentActivity[]>>('/api/activities/recent', {
    params: { ...scope(groupId), limit }
  });
  return data ?? [];
};

/** The same numbers the relationship dashboard shows, answered by the same endpoint. */
export const getMilestones = async (groupId?: string): Promise<Milestones> => {
  const { data } = await journalApi.get<Envelope<Milestones>>('/api/statistics/milestones', {
    params: scope(groupId)
  });
  return data;
};

const pad = (n: number) => String(n).padStart(2, '0');
/** Today in the browser's zone; the UTC date is still yesterday just after midnight in Tallinn. */
export const localToday = (now: Date = new Date()): string =>
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

/** The next few plans not yet logged, from today on (a trip under way included). */
export const getUpcomingPlans = async (groupId?: string, limit = 3): Promise<HomePlan[]> => {
  const { data } = await journalApi.get<Envelope<HomePlan[]>>('/api/plans', {
    params: { ...scope(groupId), upcoming: 'true', startDate: localToday(), limit }
  });
  return data ?? [];
};
