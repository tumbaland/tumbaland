import logger from '../logging/logger';

/**
 * Who a group's pooled usage bills to, read over the internal-service channel.
 *
 * The JWT carries `groups` — the ids a user belongs to — but never says who
 * owns them, and no service outside group-service has the collection. So a
 * chokepoint that needs the *quota subject* for a group album or a group ticker
 * has to ask. See MONETIZATION.md's note on why that subject is the owner and
 * not the uploader.
 *
 * Same 60s TTL as the entitlement client, for a weaker reason: ownership moves
 * far more rarely than a plan does, so the cache could be much longer, but a
 * stale owner bills the wrong person and one shared number is one fewer thing
 * to reason about. The enforcement points are writes, so the traffic is low
 * either way.
 */
const CACHE_TTL_MS = 60_000;

/** Bounded so a service under enumeration can't grow the cache without limit. */
const MAX_CACHE_ENTRIES = 5_000;

const REQUEST_TIMEOUT_MS = 3_000;

export interface GroupOwner {
  groupId: string;
  ownerEmail: string;
  memberCount: number;
  /** Soft-deleted groups still resolve: their photos still occupy storage. */
  deleted: boolean;
  /** True when group-service could not be reached and nothing was resolved. */
  stale?: boolean;
}

interface CacheEntry {
  value: GroupOwner;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Concurrent callers for one group share a request — a burst of uploads into
 * the same shared album is the expected shape of this traffic.
 */
const inFlight = new Map<string, Promise<GroupOwner | null>>();

function putInCache(groupId: string, value: GroupOwner): void {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    // Map iterates in insertion order, so the first key is the oldest write.
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(groupId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

interface GroupOwnerResponse {
  success?: boolean;
  groupId?: string;
  ownerEmail?: string;
  memberCount?: number;
  deleted?: boolean;
}

/**
 * Prefers the container-network address over the public hostname.
 *
 * `GROUP_API_URL` cannot simply be pointed inward: the frontend containers
 * template that same variable into the `config.json` the *browser* downloads,
 * so a Docker-internal value there breaks every group call in the UI. One
 * variable genuinely has two consumers with incompatible needs, so this is the
 * server-side half of it.
 *
 * Falling back to the public URL keeps local dev (where only `GROUP_API_URL` is
 * set) and any un-migrated deployment working — it just takes the long way
 * round, out through the proxy and back, carrying the internal token across the
 * public edge.
 */
function internalGroupUrl(): string | undefined {
  return process.env.GROUP_INTERNAL_URL || process.env.GROUP_API_URL;
}

async function fetchGroupOwner(groupId: string): Promise<GroupOwner | null> {
  const baseUrl = internalGroupUrl();
  const token = process.env.INTERNAL_SERVICE_TOKEN;
  const serviceId = process.env.SERVICE_NAME || 'unknown-service';

  if (!baseUrl || !token) {
    logger.error('Group owner lookup not configured', {
      hasGroupApiUrl: Boolean(baseUrl),
      hasInternalToken: Boolean(token)
    });
    return null;
  }

  try {
    const response = await fetch(`${baseUrl}/internal/groups/${encodeURIComponent(groupId)}/owner`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': token,
        'x-service-id': serviceId
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });

    // A 404 is an answer, not an outage: the group is gone. Distinguished from
    // an unreachable service because the two want opposite handling — one is
    // permanent and cacheable, the other must be retried on the next request.
    if (response.status === 404) {
      logger.warn('Group owner lookup found no such group', { groupId });
      return null;
    }

    if (!response.ok) {
      logger.error('Group owner lookup failed', { groupId, status: response.status });
      return null;
    }

    const body = (await response.json()) as GroupOwnerResponse;
    if (!body.ownerEmail) {
      logger.error('Group owner lookup returned no owner', { groupId });
      return null;
    }

    return {
      groupId: body.groupId ?? groupId,
      ownerEmail: body.ownerEmail.trim().toLowerCase(),
      memberCount: body.memberCount ?? 0,
      deleted: body.deleted === true
    };
  } catch (err) {
    logger.error('Group owner lookup errored', { groupId, error: (err as Error)?.message });
    return null;
  }
}

/**
 * The group's owner, cached for {@link CACHE_TTL_MS}, or `null` when the group
 * does not exist or group-service could not answer.
 *
 * Nothing negative is cached — neither a missing group nor a failure. A group
 * that 404s is nearly always a caller passing a bad id, so caching it would
 * spend memory on garbage, and caching a failure would keep billing the wrong
 * subject for a minute after the outage ended.
 */
export async function getGroupOwner(groupId: string): Promise<GroupOwner | null> {
  const key = String(groupId).trim();
  if (!key) return null;

  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = fetchGroupOwner(key)
    .then(value => {
      if (value) putInCache(key, value);
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);
  return request;
}

/**
 * Drop a group's cached owner. Call after anything that moves the `owner` role,
 * to collapse the window in which usage bills to the previous owner.
 */
export function invalidateGroupOwner(groupId: string): void {
  cache.delete(String(groupId).trim());
}

/** Empties the whole cache. Test seam, and a lever after a bulk ownership edit. */
export function clearGroupOwnerCache(): void {
  cache.clear();
  inFlight.clear();
}
