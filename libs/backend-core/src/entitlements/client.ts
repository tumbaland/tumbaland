import logger from '../logging/logger';
import { FALLBACK_PLAN, normalizeLimits, resolveLimits } from './definitions';
import { Entitlements } from './types';

/**
 * Entitlements are read over the internal-service channel, not carried on the
 * JWT.
 *
 * The JWT is signed for 24h and no service outside auth-service checks
 * `tokenVersion`, so a plan embedded in it would be stale in both directions:
 * a user who upgrades waits up to a day for what they just paid for, and a user
 * who cancels keeps paid features for up to a day. A 60-second cache in front
 * of a live lookup bounds that to a minute, and the enforcement points are
 * writes and dispatches — low frequency — so the network cost is negligible.
 */
const CACHE_TTL_MS = 60_000;

/** Bounded so a service under enumeration can't grow the cache without limit. */
const MAX_CACHE_ENTRIES = 5_000;

const REQUEST_TIMEOUT_MS = 3_000;

interface CacheEntry {
  value: Entitlements;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Concurrent callers for the same email share one request. Without this, a
 * burst of uploads from one user on a cold cache fans out into one
 * payment-service call each.
 */
const inFlight = new Map<string, Promise<Entitlements>>();

function cacheKey(email: string): string {
  return email.trim().toLowerCase();
}

function putInCache(key: string, value: Entitlements): void {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    // Map iterates in insertion order, so the first key is the oldest write.
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * Fail closed: an unreachable payment-service degrades everyone to free limits
 * rather than handing the product out for the length of the outage. The blast
 * radius is bounded by design — reads are never gated, only writes and
 * dispatches — so the worst case is "cannot upload for a minute", not
 * "cannot use the app".
 */
function fallbackEntitlements(email: string): Entitlements {
  return {
    email,
    planCode: FALLBACK_PLAN,
    status: null,
    limits: resolveLimits(FALLBACK_PLAN),
    stale: true
  };
}

interface EntitlementResponse {
  success?: boolean;
  planCode?: string;
  status?: string | null;
  limits?: Parameters<typeof normalizeLimits>[0];
  upgradeTo?: string;
}

/**
 * Prefers the container-network address over the public hostname.
 *
 * `PAYMENT_API_URL` cannot simply be pointed inward: payment-front's entrypoint
 * templates that same variable into the `config.json` the *browser* downloads,
 * so a Docker-internal value there breaks the subscription and checkout pages.
 * One variable, two consumers with incompatible needs — this is the server-side
 * half of it.
 *
 * Falling back keeps local dev (where only `PAYMENT_API_URL` is set) and any
 * un-migrated deployment working; it just takes the long way round, out through
 * the proxy and back, carrying the internal token across the public edge.
 */
function internalPaymentUrl(): string | undefined {
  return process.env.PAYMENT_INTERNAL_URL || process.env.PAYMENT_API_URL;
}

async function fetchEntitlements(email: string): Promise<Entitlements> {
  const baseUrl = internalPaymentUrl();
  const token = process.env.INTERNAL_SERVICE_TOKEN;
  const serviceId = process.env.SERVICE_NAME || 'unknown-service';

  if (!baseUrl || !token) {
    logger.error('Entitlement lookup not configured', {
      hasPaymentApiUrl: Boolean(baseUrl),
      hasInternalToken: Boolean(token)
    });
    return fallbackEntitlements(email);
  }

  try {
    const response = await fetch(`${baseUrl}/internal/entitlements?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': token,
        'x-service-id': serviceId
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });

    if (!response.ok) {
      logger.error('Entitlement lookup failed', { email, status: response.status });
      return fallbackEntitlements(email);
    }

    const body = (await response.json()) as EntitlementResponse;
    const planCode = body.planCode || FALLBACK_PLAN;
    return {
      email,
      planCode,
      status: body.status ?? null,
      // Re-normalized on this side too: the payload crossed a network boundary
      // and a partially-configured plan must not leave a meter undefined.
      limits: normalizeLimits(body.limits, planCode),
      upgradeTo: body.upgradeTo
    };
  } catch (err) {
    logger.error('Entitlement lookup errored', { email, error: (err as Error)?.message });
    return fallbackEntitlements(email);
  }
}

/**
 * The user's current plan and limits, cached for {@link CACHE_TTL_MS}.
 *
 * Failures are never cached — a fallback result would otherwise pin a paying
 * user to free limits for a full minute after the outage ended.
 */
export async function getEntitlements(email: string): Promise<Entitlements> {
  const key = cacheKey(email);

  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = fetchEntitlements(key)
    .then(value => {
      if (!value.stale) putInCache(key, value);
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);
  return request;
}

/**
 * Drop a user's cached entitlements. Call after anything that changes their
 * plan (checkout completed, subscription canceled) to collapse the staleness
 * window from 60s to zero for the user who is watching.
 */
export function invalidateEntitlements(email: string): void {
  cache.delete(cacheKey(email));
}

/** Empties the whole cache. Test seam, and a usable lever after a bulk plan edit. */
export function clearEntitlementsCache(): void {
  cache.clear();
  inFlight.clear();
}
