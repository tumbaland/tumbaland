import { logger } from '@tumbaland/backend-core';

/**
 * Who may manage a group's shared things, asked of group-service.
 *
 * The session token carries the groups someone is in, not their role in them,
 * and no service but group-service holds the collection. So an admin-only action
 * in a chat has to ask. Cached for a minute: roles change rarely, and a stale
 * answer for a minute only delays a promotion or a demotion by that much.
 */

const CACHE_MS = 60_000;
const MAX_ENTRIES = 2_000;
const TIMEOUT_MS = 3_000;

const cache = new Map<string, { managers: string[]; expiresAt: number }>();

export const resetGroupRoleCache = (): void => cache.clear();

/**
 * Lowercase emails of the group's owner and admins, or null when group-service
 * could not answer. A null is never read as "yes": callers treat it as nobody.
 */
export async function groupManagers(groupId: string): Promise<string[] | null> {
  const hit = cache.get(groupId);
  if (hit && hit.expiresAt > Date.now()) return hit.managers;

  const baseUrl = process.env.GROUP_INTERNAL_URL || process.env.GROUP_API_URL;
  const token = process.env.INTERNAL_SERVICE_TOKEN;
  if (!baseUrl || !token) {
    logger.error('Group role lookup not configured');
    return null;
  }

  try {
    const response = await fetch(`${baseUrl}/internal/groups/${encodeURIComponent(groupId)}/managers`, {
      headers: { 'x-internal-token': token, 'x-service-id': process.env.SERVICE_NAME || 'chat-service' },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (!response.ok) {
      logger.warn('Group role lookup failed', { groupId, status: response.status });
      return null;
    }
    const body = (await response.json()) as { managers?: string[] };
    const managers = (body.managers ?? []).map((email) => email.toLowerCase());
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
    cache.set(groupId, { managers, expiresAt: Date.now() + CACHE_MS });
    return managers;
  } catch (error) {
    logger.warn('Group role lookup errored', { groupId, error: (error as Error).message });
    return null;
  }
}

/** Whether this person is an owner or admin of the group. */
export async function isGroupManager(groupId: string, email: string): Promise<boolean> {
  return ((await groupManagers(groupId)) ?? []).includes(email.toLowerCase());
}
