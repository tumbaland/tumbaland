import { callService, serviceUrl, TumbalandError } from './http';
import {
  activitiesResponseSchema,
  activityResponseSchema,
  activityTypesResponseSchema,
  daysResponseSchema,
  parseResponse,
  planSchema,
  plansResponseSchema,
  statisticsResponseSchema,
  trendsResponseSchema,
  type Plan,
  type Statistics,
  type Trends
} from './schemas';

/**
 * A thin client over the relationship API.
 *
 * The MCP server deliberately does not touch MongoDB. Every rule that makes a
 * write correct — tenant scoping, validation, plan limits, the group access
 * query — already lives in the services, and reimplementing any of it here
 * would mean two places to keep in step and one of them silently wrong. So this
 * forwards the caller's own credential and lets relationship-service decide.
 */

export { TumbalandError };

export interface ActivityType {
  _id: string;
  name: string;
  slug: string;
  valueType: 'string' | 'boolean' | 'number';
  hasLocation: boolean;
  color?: string;
  /** absent on a personal type */
  groupId?: string;
}

/**
 * Keep one type per name: the acting tenant's own, over an inherited one.
 *
 * Listing a group returns its types *plus* the user's personal ones as a
 * fallback, so a name can arrive twice — and picking the wrong one is a silent
 * fault, not a loud one. An entry filed against a shadowed personal "Together"
 * renders correctly in the day view and quietly splits the statistics in two.
 *
 * Shadowing rather than showing both is also what the model needs: a list with
 * "Together" in it twice is a list it cannot choose from.
 */
export function preferTenant(types: ActivityType[], groupId?: string): ActivityType[] {
  const byName = new Map<string, ActivityType>();

  for (const type of types) {
    const key = type.name.trim().toLowerCase();
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, type);
      continue;
    }
    // `groupId` undefined means acting personally, where a personal type is the
    // one that belongs and a group type is the inherited one.
    if (type.groupId === groupId && existing.groupId !== groupId) byName.set(key, type);
  }

  return [...byName.values()];
}

export interface Activity {
  _id: string;
  date: string;
  /**
   * Populated on `/activities` and a bare id on `/days`.
   *
   * The two endpoints disagree, so callers must handle both — reading it as an
   * id everywhere produced "Unknown type" against every real activity while
   * looking like a working search.
   */
  typeId: string | ActivityType;
  description?: string;
  hours?: number;
  location?: { label: string; lat: number; lng: number };
}

/** The type an activity is recorded against, whichever shape it arrived in. */
export const activityTypeOf = (
  activity: Activity,
  namesById: Map<string, string>
): string | undefined =>
  typeof activity.typeId === 'string'
    ? namesById.get(activity.typeId)
    : activity.typeId?.name;

/** An entry already stored on a day; `_id` is what marks it as one to keep. */
export interface ExistingEntry {
  _id: string;
  typeId: string;
  description?: string;
  hours?: number;
  location?: { label: string; lat: number; lng: number };
}

export interface DayEntry {
  /** present for an entry that already exists — omitting it would delete that entry */
  _id?: string;
  typeId: string;
  description?: string;
  hours?: number;
  location?: { label: string; lat: number; lng: number } | null;
}

/** What a plan is made from. Times are HH:mm in the plan's zone; null clears. */
export interface PlanInput {
  title: string;
  date: string;
  endDate?: string | null;
  time?: string | null;
  timeZone?: string;
  notes?: string;
  typeId?: string | null;
  remindBefore?: number | null;
}

const relationshipUrl = () => serviceUrl('RELATIONSHIP');

/** One call against relationship-service, carrying the caller's credential. */
const call = <T>(
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
  query?: Record<string, string | number | undefined>
): Promise<T> => {
  // `groupId` rides in the query string on every verb, including writes. The
  // credential middleware validates it against the grant and copies it into the
  // body itself, so a POST does not need to carry it twice.
  return callService<T>(relationshipUrl(), apiKey, method, path, body, query);
};

export const tumbaland = {
  // The list endpoints return a named collection alongside pagination, not a
  // bare array — `{ types: [...] }` and `{ activities: [...] }`. Unwrapped here
  // so the tools only ever see the list they asked for.
  listActivityTypes: async (apiKey: string, groupId?: string): Promise<ActivityType[]> => {
    const body = await call<unknown>(apiKey, 'GET', '/activity-types', undefined, { groupId });
    const { types } = parseResponse(activityTypesResponseSchema, '/activity-types', body);
    return preferTenant(types as ActivityType[], groupId);
  },

  createActivity: (
    apiKey: string,
    activity: { date: string; typeId: string; description?: string; hours?: number },
    groupId?: string
  ): Promise<Activity> =>
    call<Activity>(apiKey, 'POST', '/activities', activity, { groupId }),

  saveDay: (apiKey: string, date: string, entries: DayEntry[], groupId?: string): Promise<unknown> =>
    call(apiKey, 'PUT', `/days/${date}`, { entries }, { groupId }),

  /** One day's existing entries, so a write can add to them rather than replace them. */
  getDay: async (apiKey: string, date: string, groupId?: string): Promise<ExistingEntry[]> => {
    const body = await call<unknown>(apiKey, 'GET', '/days', undefined, {
      startDate: date,
      endDate: date,
      groupId
    });
    const parsed = parseResponse(daysResponseSchema, '/days', body);
    return (parsed.days.find((day) => day.date === date)?.entries ?? []) as ExistingEntry[];
  },

  /**
   * `startDate`/`endDate`, and `activityType` as a *slug* — the names the
   * controller actually reads. Unknown query parameters are ignored rather than
   * rejected, so getting these wrong returns a confident, unfiltered answer
   * instead of an error. That is worse than a 400 and is exactly how this was
   * shipped broken the first time.
   */
  listActivities: async (
    apiKey: string,
    params: {
      startDate?: string;
      endDate?: string;
      activityType?: string;
      limit?: number;
      groupId?: string;
    }
  ): Promise<Activity[]> => {
    // Newest first. The endpoint's own default is oldest-first, which makes
    // "what did we do most recently" — the commonest question anyone asks an
    // assistant about a journal — a search through date windows rather than one
    // call. A person scrolling a page wants the start; an agent wants the end.
    const body = await call<unknown>(apiKey, 'GET', '/activities', undefined, {
      ...params,
      sortBy: 'date',
      sortOrder: 'desc'
    });
    return parseResponse(activitiesResponseSchema, '/activities', body).activities as Activity[];
  },

  /**
   * One entry by id, so an edit can say what it is about to change.
   *
   * Read before writing rather than after: an id the model got wrong should
   * fail before anything is modified, and the caller wants to be told which
   * entry was touched, not merely that something was.
   */
  getActivity: async (apiKey: string, id: string, groupId?: string): Promise<Activity> => {
    const body = await call<unknown>(apiKey, 'GET', `/activities/${id}`, undefined, { groupId });
    return parseResponse(activityResponseSchema, `/activities/${id}`, body) as Activity;
  },

  updateActivity: async (
    apiKey: string,
    id: string,
    patch: { date?: string; typeId?: string; description?: string; hours?: number },
    groupId?: string
  ): Promise<Activity> => {
    const body = await call<unknown>(apiKey, 'PUT', `/activities/${id}`, patch, { groupId });
    return parseResponse(activityResponseSchema, `/activities/${id}`, body) as Activity;
  },

  deleteActivity: (apiKey: string, id: string, groupId?: string): Promise<unknown> =>
    call(apiKey, 'DELETE', `/activities/${id}`, undefined, { groupId }),

  /** Plans in a range of days, or the upcoming ones (not yet logged) from `startDate` on. */
  listPlans: async (
    apiKey: string,
    params: { startDate?: string; endDate?: string; upcoming?: boolean; limit?: number; groupId?: string }
  ): Promise<Plan[]> => {
    const { upcoming, ...rest } = params;
    const body = await call<unknown>(apiKey, 'GET', '/plans', undefined, {
      ...rest,
      upcoming: upcoming ? 'true' : undefined
    });
    return parseResponse(plansResponseSchema, '/plans', body);
  },

  getPlan: async (apiKey: string, id: string, groupId?: string): Promise<Plan> => {
    const body = await call<unknown>(apiKey, 'GET', `/plans/${id}`, undefined, { groupId });
    return parseResponse(planSchema, `/plans/${id}`, body);
  },

  createPlan: async (apiKey: string, plan: PlanInput, groupId?: string): Promise<Plan> => {
    const body = await call<unknown>(apiKey, 'POST', '/plans', plan, { groupId });
    return parseResponse(planSchema, '/plans', body);
  },

  updatePlan: async (apiKey: string, id: string, patch: Partial<PlanInput>, groupId?: string): Promise<Plan> => {
    const body = await call<unknown>(apiKey, 'PATCH', `/plans/${id}`, patch, { groupId });
    return parseResponse(planSchema, `/plans/${id}`, body);
  },

  deletePlan: (apiKey: string, id: string, groupId?: string): Promise<unknown> =>
    call(apiKey, 'DELETE', `/plans/${id}`, undefined, { groupId }),

  getStatistics: async (apiKey: string, timeframe: string, groupId?: string): Promise<Statistics> => {
    const body = await call<unknown>(apiKey, 'GET', '/statistics', undefined, { timeframe, groupId });
    return parseResponse(statisticsResponseSchema, '/statistics', body);
  },

  getTrends: async (apiKey: string, windowDays?: number, groupId?: string): Promise<Trends> => {
    const body = await call<unknown>(apiKey, 'GET', '/statistics/trends', undefined, {
      window: windowDays,
      groupId
    });
    return parseResponse(trendsResponseSchema, '/statistics/trends', body);
  }
};

/**
 * Resolve a human name to an activity type.
 *
 * The single most important piece of ergonomics here. An agent is told about
 * "dinner", never about `68b7c1e2f3a4b5c6d7e8f900`, and asking a model to carry
 * an ObjectId around is asking it to hallucinate one. Matching is
 * case-insensitive on both name and slug, and a miss throws with the list of
 * real types — an error that says "no type 'dinner'; you have: Dinner, Walk"
 * gets the next attempt right, where "invalid typeId" teaches nothing.
 */
export function resolveType(types: ActivityType[], name: string): ActivityType {
  const wanted = name.trim().toLowerCase();
  const match = types.find(
    (type) => type.name.toLowerCase() === wanted || type.slug.toLowerCase() === wanted
  );

  if (!match) {
    const available = types.map((type) => type.name).join(', ') || '(none defined yet)';
    throw new TumbalandError(
      `No activity type called "${name}". Available types: ${available}. ` +
        'Use one of these, or ask the user whether to create a new type in the app.',
      400
    );
  }

  return match;
}
