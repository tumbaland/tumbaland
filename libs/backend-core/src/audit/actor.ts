import type { Request } from 'express';
import { PERSONAL_TENANT, type Tenant } from '../apiKeys/types';

/**
 * Who is acting, in the only three ways anything reaches this system.
 *
 * The distinction that matters is `person` against everything else. A person is
 * at a keyboard and can see what they are doing; a key or an assistant is
 * software acting on their behalf, and is the thing an audit trail exists to
 * make legible. Splitting `key` from `assistant` is worth the extra case because
 * they fail differently: a key is a secret someone pasted somewhere and may have
 * lost, an assistant is a consent screen someone approved and can withdraw.
 */
export type ActorKind = 'person' | 'key' | 'assistant';

export interface Actor {
  kind: ActorKind;
  /** the account being acted for — the same whichever kind of actor it is */
  userId: string;
  /** what to show in a trail: the person's name, the key's name, the app's name */
  label: string;
  /**
   * The credential, for software.
   *
   * A key's document id, or an OAuth client id. Deliberately not the access
   * token's `jti`, which rotates hourly and would show a different actor after
   * every refresh.
   */
  credentialId?: string;
  /** the journal this request is acting in */
  tenant: Tenant;
}

/**
 * Read the actor off a request that has already been authenticated.
 *
 * Returns null for an unauthenticated request rather than inventing an
 * anonymous actor: there is nothing to attribute, and a row saying so would be
 * a row about the transport, not about anyone.
 */
export function actorOf(req: Request): Actor | null {
  const user = req.user;
  if (!user?.id) return null;

  const credential = req.apiKey;
  if (!credential) {
    return {
      kind: 'person',
      userId: user.id,
      // Falling back to the email because a name is optional on a session and an
      // unlabelled row is the one nobody can act on.
      label: user.name || user.email || user.id,
      tenant: (req.query?.groupId as string) || PERSONAL_TENANT
    };
  }

  return {
    kind: credential.kind === 'oauth' ? 'assistant' : 'key',
    userId: user.id,
    label: credential.label,
    credentialId: credential.credentialId,
    tenant: credential.actingAs
  };
}

/** One line naming an actor, for a log message or an error. */
export const describeActor = (actor: Actor): string =>
  actor.kind === 'person' ? actor.label : `${actor.label} (${actor.kind})`;
