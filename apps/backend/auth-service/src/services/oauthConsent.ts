import { createHmac, timingSafeEqual } from 'crypto';
import { logger, requireEnv, PERSONAL_TENANT } from '@tumbaland/backend-core';

export const issuer = (): string =>
  (process.env.AUTH_SERVICE_PUBLIC_URL || 'https://auth-api.tumbaland.eu').replace(/\/$/, '');

/** The one resource this server issues tokens for. */
export const mcpResource = (): string =>
  (process.env.MCP_PUBLIC_URL || 'https://mcp.tumbaland.eu').replace(/\/$/, '');

export const authFrontUrl = (): string =>
  (process.env.AUTH_FRONT_URL || 'https://auth.tumbaland.eu').replace(/\/$/, '');

/**
 * A token binding the consent form to this user and this request.
 *
 * Without it the decision endpoint is a plain cookie-authenticated POST, and
 * any page on the internet could submit one on a signed-in visitor's behalf —
 * granting an authorization code to a client the user never saw. Deriving it
 * rather than storing it keeps the endpoint stateless; binding it to the user
 * stops an attacker minting one from their own session, and to the code
 * challenge stops it being reused for a different authorization.
 */
export const consentToken = (userId: string, clientId: string, codeChallenge: string): string =>
  createHmac('sha256', requireEnv('JWT_SECRET'))
    .update(`consent:${userId}:${clientId}:${codeChallenge}`)
    .digest('hex');

export const consentTokenValid = (
  presented: unknown,
  userId: string,
  clientId: string,
  codeChallenge: string
): boolean => {
  if (typeof presented !== 'string') return false;
  const expected = Buffer.from(consentToken(userId, clientId, codeChallenge));
  const given = Buffer.from(presented);
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
};

/**
 * What each tenant the approver could pick is called.
 *
 * The consent screen used to render `Group 539ad2` — the tail of an ObjectId —
 * which asks someone to choose between options they cannot tell apart. Names
 * come from group-service over the internal channel auth-service already uses
 * for the `groups` claim, so this needs no new configuration.
 *
 * A failure here degrades to the id rather than blocking: a consent screen that
 * will not render because a sibling service is slow is worse than one with an
 * ugly label on it.
 */
export const tenantNamesFor = async (email: string, groupIds: string[]): Promise<Record<string, string>> => {
  const names: Record<string, string> = { [PERSONAL_TENANT]: 'My own data' };
  for (const id of groupIds) names[id] = `Group ${id.slice(-6)}`;

  const groupServiceUrl = process.env.GROUP_API_URL;
  const internalToken = process.env.INTERNAL_SERVICE_TOKEN;
  if (!groupServiceUrl || !internalToken || groupIds.length === 0) return names;

  try {
    const response = await fetch(
      `${groupServiceUrl}/api/groups/mine?userEmail=${encodeURIComponent(email)}`,
      {
        headers: {
          'x-internal-token': internalToken,
          'x-service-id': 'auth-service'
        },
        signal: AbortSignal.timeout(3000)
      }
    );
    if (!response.ok) return names;

    const body = (await response.json()) as { success?: boolean; data?: { _id?: string; name?: string }[] };
    for (const group of body.data ?? []) {
      if (group?._id && group.name) names[String(group._id)] = group.name;
    }
  } catch (error) {
    logger.warn('Could not resolve group names for the consent screen', {
      error: (error as Error)?.message
    });
  }

  return names;
};
