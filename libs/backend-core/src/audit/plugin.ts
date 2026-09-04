import type { Model, Schema } from 'mongoose';
import logger from '../logging/logger';
import { AuditEvent } from './AuditEvent';
import { currentAuditContext } from './context';

/** Bookkeeping fields nobody wants to read in a change list. */
const NOISE = new Set(['updatedAt', 'createdAt', '__v', 'createdBy', 'updatedBy']);

/**
 * Where a hook stashes what it read before the write.
 *
 * A symbol on the query object, not `query.set()` — that method writes into the
 * *update payload*, so stashing there would persist the before-image into the
 * document it was taken of. Per-query, so concurrent writes cannot read each
 * other's.
 */
const BEFORE = Symbol('auditBefore');

/** Comparable form, so a Date and an ObjectId do not read as changed every time. */
const plain = (value: unknown): unknown => {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && 'toHexString' in (value as object)) return String(value);
  return value;
};

const changesBetween = (
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[]
): Record<string, { from: unknown; to: unknown }> | undefined => {
  const changes: Record<string, { from: unknown; to: unknown }> = {};

  for (const field of fields) {
    if (NOISE.has(field)) continue;
    const from = plain(before?.[field]);
    const to = plain(after?.[field]);
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[field] = { from, to };
  }

  return Object.keys(changes).length > 0 ? changes : undefined;
};

/**
 * Never let recording a thing fail the thing.
 *
 * An audit trail is worth having and is not worth refusing a write over: a
 * failure here means someone loses a row of history, and throwing would mean
 * they lose the entry they were logging. So it is fire-and-forget with the
 * failure written to the ordinary log, where an operator sees it.
 */
const record = (event: Record<string, unknown>): void => {
  void AuditEvent.create(event).catch((error) => {
    logger.warn('Could not record an audit event', {
      error: (error as Error)?.message,
      action: event.action,
      resource: event.resource
    });
  });
};

export interface AuditPluginOptions {
  /** what these documents are called in a trail — 'activity', 'photo' */
  resource: string;
  /** fields never worth recording the content of */
  redact?: string[];
}

/**
 * Attribute and record every write to a collection.
 *
 * Applied to a model rather than called from its controllers, for two reasons.
 * The data layer is the only place that knows which fields actually changed —
 * a controller sees the patch that was requested, not the difference it made,
 * and those differ whenever a field was already the value being set. And a
 * plugin cannot be forgotten: a new endpoint that writes through the model is
 * audited without anyone remembering to add a line.
 *
 * Writes made outside a request — a migration, a backfill script — find no
 * actor and are recorded as nothing, which is honest. A row claiming a script
 * was a person would be worse than no row.
 */
export function auditPlugin(schema: Schema, options: AuditPluginOptions): void {
  const { resource, redact = [] } = options;
  const hide = new Set(redact);

  const visible = (doc: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(
      Object.entries(doc)
        .filter(([key]) => !NOISE.has(key) && !hide.has(key))
        .map(([key, value]) => [key, plain(value)])
    );

  // Who last touched this, on the record itself. Denormalized on purpose: a day
  // view showing "logged by Claude" should not have to query a second
  // collection for every row it renders.
  schema.add({
    createdBy: { type: String },
    updatedBy: { type: String }
  });

  schema.pre('save', async function () {
    const context = currentAuditContext();
    if (!context) return;

    const label = context.actor.label;
    if (this.isNew) this.set('createdBy', label);
    this.set('updatedBy', label);

    // `isNew` is false by the time the post hook runs, so it is carried here.
    // Recording every save as a create was the original mistake: any code that
    // loads a document, changes a field and saves it — revoking an API key,
    // counting a reveal — would appear in the trail as the thing being created
    // again, with a fresh snapshot and no sign of what actually changed.
    this.$locals.auditWasNew = this.isNew;
    if (this.isNew) return;

    this.$locals.auditPaths = this.modifiedPaths().filter((path) => !NOISE.has(path));
    this.$locals.auditBefore = await (this.constructor as Model<unknown>)
      .findById(this._id)
      .lean();
  });

  schema.post('save', function (doc) {
    const context = currentAuditContext();
    if (!context) return;

    const common = {
      at: new Date(),
      service: context.service,
      resource,
      resourceId: String(doc._id),
      actorKind: context.actor.kind,
      userId: context.actor.userId,
      actorLabel: context.actor.label,
      actorCredentialId: context.actor.credentialId,
      tenant: context.actor.tenant
    };

    if (doc.$locals.auditWasNew) {
      record({ ...common, action: 'create', snapshot: visible(doc.toObject()) });
      return;
    }

    const before = (doc.$locals.auditBefore ?? {}) as Record<string, unknown>;
    const paths = (doc.$locals.auditPaths ?? []) as string[];
    const changes = changesBetween(before, doc.toObject(), paths);
    if (!changes) return;

    record({ ...common, action: 'update', changes });
  });

  // The document as it stood, fetched before the write so there is something to
  // compare against. Held on the query, which is per-operation, so concurrent
  // updates cannot read each other's.
  schema.pre('findOneAndUpdate', async function () {
    const context = currentAuditContext();
    if (!context) return;

    (this as unknown as Record<symbol, unknown>)[BEFORE] = await this.model
      .findOne(this.getQuery())
      .lean();

    // This one genuinely belongs in the update: it is a field on the document.
    this.set('updatedBy', context.actor.label);
  });

  schema.post('findOneAndUpdate', function (doc) {
    const context = currentAuditContext();
    if (!context || !doc) return;

    const before = ((this as unknown as Record<symbol, unknown>)[BEFORE] ?? {}) as Record<
      string,
      unknown
    >;
    const after = doc.toObject ? doc.toObject() : (doc as Record<string, unknown>);
    // Only the fields the update touched: comparing everything would report a
    // change on any field a concurrent write happened to move.
    const update = (this.getUpdate() ?? {}) as Record<string, unknown>;
    const touched = Object.keys((update.$set as object) ?? update);
    const changes = changesBetween(before, after, touched);
    if (!changes) return;

    record({
      at: new Date(),
      service: context.service,
      action: 'update',
      resource,
      resourceId: String((doc as { _id: unknown })._id),
      actorKind: context.actor.kind,
      userId: context.actor.userId,
      actorLabel: context.actor.label,
      actorCredentialId: context.actor.credentialId,
      tenant: context.actor.tenant,
      changes
    });
  });

  schema.post('findOneAndDelete', function (doc) {
    const context = currentAuditContext();
    if (!context || !doc) return;

    record({
      at: new Date(),
      service: context.service,
      action: 'delete',
      resource,
      resourceId: String((doc as { _id: unknown })._id),
      actorKind: context.actor.kind,
      userId: context.actor.userId,
      actorLabel: context.actor.label,
      actorCredentialId: context.actor.credentialId,
      tenant: context.actor.tenant,
      // The whole document, because a delete is the one action whose record is
      // the only remaining copy of what was there.
      snapshot: visible(doc.toObject ? doc.toObject() : (doc as Record<string, unknown>))
    });
  });

  // Bulk deletes are read back first, one row each. A day's save deletes the
  // entries it is replacing, and "the day editor removed three things" is
  // exactly the change someone would come here to find.
  schema.pre('deleteMany', async function () {
    if (!currentAuditContext()) return;
    (this as unknown as Record<symbol, unknown>)[BEFORE] = await this.model
      .find(this.getQuery())
      .lean();
  });

  schema.post('deleteMany', function () {
    const context = currentAuditContext();
    if (!context) return;

    const doomed = ((this as unknown as Record<symbol, unknown>)[BEFORE] ?? []) as Record<
      string,
      unknown
    >[];
    for (const doc of doomed) {
      record({
        at: new Date(),
        service: context.service,
        action: 'delete',
        resource,
        resourceId: String(doc._id),
        actorKind: context.actor.kind,
        userId: context.actor.userId,
        actorLabel: context.actor.label,
        actorCredentialId: context.actor.credentialId,
        tenant: context.actor.tenant,
        snapshot: visible(doc)
      });
    }
  });
}
