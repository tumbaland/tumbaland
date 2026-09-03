import { requireEnv } from '@tumbaland/backend-core';

/**
 * A thin client over the existing Tumbaland HTTP API.
 *
 * The MCP server deliberately does not touch MongoDB. Every rule that makes a
 * write correct — tenant scoping, validation, plan limits, the group access
 * query — already lives in the services, and reimplementing any of it here
 * would mean two places to keep in step and one of them silently wrong. So this
 * forwards the caller's own API key and lets relationship-service decide.
 */

export interface ActivityType {
  _id: string;
  name: string;
  slug: string;
  valueType: 'string' | 'boolean' | 'number';
  hasLocation: boolean;
  color?: string;
}

export interface Activity {
  _id: string;
  date: string;
  typeId: string;
  description?: string;
  hours?: number;
  location?: { label: string; lat: number; lng: number };
}

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

/** An API error the model can act on, rather than a stack trace. */
export class TumbalandError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'TumbalandError';
  }
}

const relationshipApiUrl = (): string =>
  (process.env.RELATIONSHIP_INTERNAL_URL || requireEnv('RELATIONSHIP_API_URL')).replace(/\/$/, '');

interface Envelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * One call against relationship-service, carrying the caller's key.
 *
 * The key is passed straight through rather than exchanged for a service token:
 * that keeps the request scoped to exactly what the user granted, so a
 * read-only key cannot be widened by passing through this hop.
 */
async function call<T>(
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
  query?: Record<string, string | number | undefined>
): Promise<T> {
  const url = new URL(`${relationshipApiUrl()}/api${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  let parsed: Envelope<T> | undefined;
  try {
    parsed = text ? (JSON.parse(text) as Envelope<T>) : undefined;
  } catch {
    // A non-JSON body means something in front of the service answered — a
    // proxy, a gateway. The status is the only trustworthy part.
  }

  if (!response.ok) {
    throw new TumbalandError(
      parsed?.message || `Request failed with status ${response.status}`,
      response.status
    );
  }

  return (parsed?.data ?? parsed) as T;
}

export const tumbaland = {
  // The list endpoints return a named collection alongside pagination, not a
  // bare array — `{ types: [...] }` and `{ activities: [...] }`. Unwrapped here
  // so the tools only ever see the list they asked for.
  listActivityTypes: async (apiKey: string): Promise<ActivityType[]> => {
    const result = await call<{ types?: ActivityType[] }>(apiKey, 'GET', '/activity-types');
    return result?.types ?? [];
  },

  createActivity: (
    apiKey: string,
    activity: { date: string; typeId: string; description?: string; hours?: number }
  ): Promise<Activity> => call<Activity>(apiKey, 'POST', '/activities', activity),

  saveDay: (apiKey: string, date: string, entries: DayEntry[]): Promise<unknown> =>
    call(apiKey, 'PUT', `/days/${date}`, { entries }),

  /** One day's existing entries, so a write can add to them rather than replace them. */
  getDay: async (apiKey: string, date: string): Promise<ExistingEntry[]> => {
    const result = await call<{ days?: { date: string; entries: ExistingEntry[] }[] }>(
      apiKey,
      'GET',
      '/days',
      undefined,
      { from: date, to: date }
    );
    return result?.days?.find((day) => day.date === date)?.entries ?? [];
  },

  listActivities: async (
    apiKey: string,
    params: { from?: string; to?: string; typeId?: string; limit?: number }
  ): Promise<Activity[]> => {
    const result = await call<{ activities?: Activity[] }>(
      apiKey,
      'GET',
      '/activities',
      undefined,
      params
    );
    return result?.activities ?? [];
  },

  getStatistics: (apiKey: string, timeframe: string): Promise<unknown> =>
    call(apiKey, 'GET', '/statistics', undefined, { timeframe }),

  getTrends: (apiKey: string, windowDays?: number): Promise<unknown> =>
    call(apiKey, 'GET', '/statistics/trends', undefined, { window: windowDays })
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
