import mongoose, { Document, Schema } from 'mongoose';
import type { ActorKind } from './actor';

/**
 * One thing that happened, and who did it.
 *
 * Lives in backend-core rather than any one service because the question it
 * answers spans them: "what did Claude do yesterday" is not a relationship
 * question or an album question. Every service writes into the same collection,
 * and `service` says which one.
 */
export interface IAuditEvent extends Document {
  at: Date;
  /** which service handled it — 'relationship-service', 'album-service' */
  service: string;
  action: 'create' | 'update' | 'delete' | 'read';
  /** what kind of thing — 'activity', 'activity_type', 'photo' */
  resource: string;
  resourceId?: string;
  actorKind: ActorKind;
  /** the account acted for; every listing is scoped to this */
  userId: string;
  actorLabel: string;
  /** a key's id or an OAuth client id; absent when a person acted directly */
  actorCredentialId?: string;
  /** the journal it happened in */
  tenant: string;
  /**
   * What changed, field by field.
   *
   * Present on updates. This is the difference between an audit log and a
   * request log: "Claude edited an entry" is barely worth storing, "Claude
   * changed hours from 3 to 2" is the thing someone actually wants to see.
   */
  changes?: Record<string, { from: unknown; to: unknown }>;
  /** what a delete removed, so it can be read back or restored by hand */
  snapshot?: Record<string, unknown>;
  /** how many records a read returned — the size of what left the server */
  count?: number;
  createdAt: Date;
}

const AuditEventSchema = new Schema<IAuditEvent>(
  {
    at: { type: Date, required: true, default: Date.now },
    service: { type: String, required: true },
    action: { type: String, required: true, enum: ['create', 'update', 'delete', 'read'] },
    resource: { type: String, required: true },
    resourceId: { type: String },
    actorKind: { type: String, required: true, enum: ['person', 'key', 'assistant'] },
    userId: { type: String, required: true, index: true },
    actorLabel: { type: String, required: true },
    actorCredentialId: { type: String },
    tenant: { type: String, required: true },
    changes: { type: Schema.Types.Mixed },
    snapshot: { type: Schema.Types.Mixed },
    count: { type: Number }
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'audit_events' }
);

// Every listing is one account's trail, newest first.
AuditEventSchema.index({ userId: 1, at: -1 });

/**
 * Rows expire on their own.
 *
 * They carry journal content — the old value of a description, a deleted
 * entry — so keeping them indefinitely would quietly build a second copy of the
 * journal that nothing in the product ever deletes from. A year is long enough
 * to answer "what happened" and short enough that the copy does not outlive the
 * question.
 */
const RETENTION_DAYS = 365;
AuditEventSchema.index({ at: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

export const AuditEvent = mongoose.models.AuditEvent
  ? (mongoose.models.AuditEvent as mongoose.Model<IAuditEvent>)
  : mongoose.model<IAuditEvent>('AuditEvent', AuditEventSchema);
