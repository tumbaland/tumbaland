import { AuditEvent, type IAuditEvent } from './AuditEvent';
import type { ActorKind } from './actor';

export interface AuditQuery {
  userId: string;
  /** narrow to one actor — a key's id or an OAuth client id */
  credentialId?: string;
  actorKind?: ActorKind;
  action?: IAuditEvent['action'];
  resource?: string;
  /** narrow to one area — 'relationship-service', 'album-service' */
  service?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  page?: number;
}

export interface AuditEntry {
  id: string;
  at: string;
  service: string;
  action: IAuditEvent['action'];
  resource: string;
  resourceId?: string;
  actorKind: ActorKind;
  actorLabel: string;
  actorCredentialId?: string;
  tenant: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
  snapshot?: Record<string, unknown>;
  count?: number;
}

const toEntry = (event: IAuditEvent): AuditEntry => ({
  id: String(event._id),
  at: event.at.toISOString(),
  service: event.service,
  action: event.action,
  resource: event.resource,
  resourceId: event.resourceId,
  actorKind: event.actorKind,
  actorLabel: event.actorLabel,
  actorCredentialId: event.actorCredentialId,
  tenant: event.tenant,
  changes: event.changes,
  snapshot: event.snapshot,
  count: event.count
});

/**
 * One account's trail, newest first.
 *
 * Always scoped to `userId` by the query rather than filtered afterwards, so
 * there is no path where a wider read is one forgotten condition away. The trail
 * carries old values of journal entries, which makes it as sensitive as the
 * journal itself.
 */
export const listAuditEvents = async (
  query: AuditQuery
): Promise<{ events: AuditEntry[]; total: number; page: number; totalPages: number }> => {
  const limit = Math.min(query.limit ?? 50, 200);
  const page = Math.max(query.page ?? 1, 1);

  const filter: Record<string, unknown> = { userId: query.userId };
  if (query.credentialId) filter.actorCredentialId = query.credentialId;
  if (query.actorKind) filter.actorKind = query.actorKind;
  if (query.action) filter.action = query.action;
  if (query.resource) filter.resource = query.resource;
  if (query.service) filter.service = query.service;
  if (query.from || query.to) {
    const at: Record<string, Date> = {};
    if (query.from) at.$gte = query.from;
    if (query.to) at.$lte = query.to;
    filter.at = at;
  }

  const [events, total] = await Promise.all([
    AuditEvent.find(filter)
      .sort({ at: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    AuditEvent.countDocuments(filter)
  ]);

  return {
    events: events.map(toEntry),
    total,
    page,
    totalPages: Math.ceil(total / limit)
  };
};
