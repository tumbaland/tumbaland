import logger from '../logging/logger';
import { internalGroupUrl } from './client';

/**
 * Which groups a person belongs to, asked of group-service.
 *
 * This used to travel in the session token's `groups` claim, which made it only
 * as fresh as the token: a new member could not see the group until their next
 * renewal, and a removed one kept access until theirs, which is why membership
 * changes used to sign people out. Asked here instead, with a short cache, a
 * change reaches every service within CACHE_TTL_MS.
 *
 * Every request pays for this only once per person per service per cache
 * window; concurrent callers share one request.
 */
const CACHE_TTL_MS = 30_000;

/** Bounded so a service under enumeration can't grow the cache without limit. */
const MAX_CACHE_ENTRIES = 5_000;

const REQUEST_TIMEOUT_MS = 3_000;

interface CacheEntry {
  groups: string[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<string[] | null>>();

function putInCache(email: string, groups: string[]): void {
  if (!cache.has(email) && cache.size >= MAX_CACHE_ENTRIES) {
    // Map iterates in insertion order, so the first key is the oldest write.
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(email, { groups, expiresAt: Date.now() + CACHE_TTL_MS });
}

async function fetchUserGroupIds(email: string): Promise<string[] | null> {
  const baseUrl = internalGroupUrl();
  const token = process.env.INTERNAL_SERVICE_TOKEN;

  if (!baseUrl || !token) {
    logger.error('Group membership lookup not configured', {
      hasGroupApiUrl: Boolean(baseUrl),
      hasInternalToken: Boolean(token)
    });
    return null;
  }

  try {
    const response = await fetch(`${baseUrl}/api/groups/mine/ids?userEmail=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': token,
        'x-service-id': process.env.SERVICE_NAME || 'unknown-service'
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });

    if (!response.ok) {
      logger.error('Group membership lookup failed', { email, status: response.status });
      return null;
    }

    const body = (await response.json()) as { success?: boolean; data?: unknown };
    if (!body.success || !Array.isArray(body.data)) {
      logger.error('Group membership lookup returned no list', { email });
      return null;
    }
    return body.data.filter((id): id is string => typeof id === 'string');
  } catch (error) {
    logger.error('Group membership lookup unreachable', { email, error: (error as Error)?.message });
    return null;
  }
}

/**
 * The ids of the groups `email` belongs to right now.
 *
 * When group-service cannot be asked, the last answer is used even if it has
 * expired, and failing that no groups at all: a person keeps their own data
 * through an outage and loses group data until it ends, rather than being
 * granted a group on a guess.
 */
export async function getUserGroupIds(email: string): Promise<string[]> {
  const key = email.toLowerCase();
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.groups;

  let pending = inFlight.get(key);
  if (!pending) {
    pending = fetchUserGroupIds(key).finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }

  const groups = await pending;
  if (groups) {
    putInCache(key, groups);
    return groups;
  }
  if (entry) {
    logger.warn('Using the last known group membership while group-service is unreachable', { email: key });
    return entry.groups;
  }
  return [];
}

/** For tests. */
export function clearMembershipCache(): void {
  cache.clear();
  inFlight.clear();
}

type MembershipLookup = (user: { email: string; groups?: string[] }) => Promise<string[]>;

const lookUpMembership: MembershipLookup = (user) => getUserGroupIds(user.email);
let membershipLookup: MembershipLookup = lookUpMembership;

/** The groups the auth middlewares put on `req.userGroups`. */
export const currentGroupsOf = (user: { email: string; groups?: string[] }): Promise<string[]> =>
  membershipLookup(user);

/**
 * Replaces the lookup, for tests only; pass nothing to restore the real one.
 * Service suites reach it through `@tumbaland/backend-core/testing`, which makes
 * a test token's own `groups` claim the membership, so they need no group-service.
 */
export function overrideMembershipLookupForTests(lookup?: MembershipLookup): void {
  membershipLookup = lookup ?? lookUpMembership;
}
