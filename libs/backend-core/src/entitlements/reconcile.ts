import mongoose from 'mongoose';
import logger from '../logging/logger';
import { MeterKey } from './definitions';
import { UsageMeter, currentPeriod } from './UsageMeter';

/**
 * Rebuild the cumulative usage meters from the data they describe.
 *
 * **Why this can exist at all:** every meter reconciled here is *derived*.
 * `storageBytes` is the sum of photo sizes, `trackedTickers` the count of
 * active symbols, `seats` the members of the groups a subject owns — in each
 * case the underlying collection is the record and the counter is only a cache
 * of it, kept hot because a quota check cannot afford the aggregation. So the
 * counter can always be recomputed, and reconciliation is cache invalidation.
 *
 * `aiJobs` is deliberately absent, and its absence is the same rule read the
 * other way: nothing records that a GPU job happened except the counter itself,
 * so there is no truth to recompute it from. That is precisely why
 * `consumeQuota` rolls its increment back on rejection rather than leaving it —
 * a leaked increment on that meter is permanent, where here it is temporary.
 *
 * **On racing with live writes:** a `consumeQuota` landing between the
 * aggregation and the write is lost. That is tolerable for exactly the reason
 * above — the next run re-derives the same number from source and converges —
 * so this is scheduled at a quiet hour rather than defended with a lock.
 *
 * Reads collections owned by other services through the raw driver rather than
 * mongoose models. They are not this library's documents to model, every
 * service shares one database, and going through the driver avoids registering
 * a second model for a schema that already exists elsewhere.
 */

/** Meters whose value can be recomputed from source data. See the note above. */
export const RECONCILED_METERS: readonly MeterKey[] = ['storageBytes', 'trackedTickers', 'seats'];

export interface ReconcileOptions {
  /** Write the corrections. Default false — the caller must opt in to mutating. */
  apply?: boolean;
  /** Restrict to a single subject, for a targeted repair. */
  subject?: string;
}

export interface MeterChange {
  subjectId: string;
  meter: MeterKey;
  /** `null` when no counter existed yet. */
  from: number | null;
  to: number;
}

export interface OrphanedMeter {
  subjectId: string;
  meter: string;
  count: number;
}

export interface ReconcileReport {
  applied: boolean;
  scannedUsers: number;
  /** Subjects with any attributable usage, before any `subject` filter. */
  subjects: number;
  expected: Record<string, Record<MeterKey, number>>;
  changes: MeterChange[];
  written: number;
  orphanedMeters: OrphanedMeter[];
  warnings: string[];
}

const normalizeEmail = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : undefined;

interface MemberRow {
  email?: string;
  role?: string;
}

interface GroupRow {
  _id: unknown;
  name?: string;
  createdBy?: string;
  members?: MemberRow[];
  deletedAt?: Date | null;
}

interface OwnedRow {
  _id: unknown;
  userId?: string;
  groupId?: string;
}

/**
 * Whoever currently holds the `owner` role — that is what group-service
 * authorizes against, and `updateMemberRole` can move it while `createdBy`
 * stays as first written. Several owners resolve to the lowest email so that a
 * re-run bills the same person twice rather than two people once.
 */
function groupOwner(group: GroupRow, warnings: string[]): string | undefined {
  const owners = (group.members ?? [])
    .filter(m => m.role === 'owner')
    .map(m => normalizeEmail(m.email))
    .filter((e): e is string => Boolean(e))
    .sort();

  if (owners.length === 1) return owners[0];

  if (owners.length === 0) {
    const fallback = normalizeEmail(group.createdBy);
    warnings.push(
      `group ${group._id} ("${group.name}") has no member with role 'owner'; billing to createdBy=${fallback ?? 'MISSING'}`
    );
    return fallback;
  }

  warnings.push(`group ${group._id} ("${group.name}") has ${owners.length} owners (${owners.join(', ')}); billing to ${owners[0]}`);
  return owners[0];
}

interface Bucket {
  storageBytes: number;
  trackedTickers: Set<string>;
  seats: Set<string>;
}

async function computeExpected(): Promise<{
  expected: Map<string, Bucket>;
  warnings: string[];
  scannedUsers: number;
}> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Cannot reconcile usage meters: no active database connection');

  const warnings: string[] = [];

  // Album.userId / TrackedTicker.userId hold `req.user.id`, which is the
  // auth-service User._id as a string, while a meter's subjectId is an email.
  // Nothing personal can be attributed without coming back through this map.
  const users = await db.collection('users').find({}, { projection: { email: 1 } }).toArray();
  const userIdToEmail = new Map<string, string>();
  for (const user of users) {
    const email = normalizeEmail(user.email);
    if (email) userIdToEmail.set(String(user._id), email);
  }

  const groups = (await db.collection('groups').find({}).toArray()) as unknown as GroupRow[];
  const groupsById = new Map<string, { doc: GroupRow; owner?: string; deleted: boolean }>();
  for (const group of groups) {
    groupsById.set(String(group._id), {
      doc: group,
      owner: groupOwner(group, warnings),
      deleted: group.deletedAt !== null && group.deletedAt !== undefined
    });
  }

  const expected = new Map<string, Bucket>();
  const bucket = (email: string): Bucket => {
    let existing = expected.get(email);
    if (!existing) {
      existing = { storageBytes: 0, trackedTickers: new Set(), seats: new Set() };
      expected.set(email, existing);
    }
    return existing;
  };
  // Every known user gets a bucket, so a user whose real usage is zero can
  // still correct a stale non-zero counter back down.
  for (const email of userIdToEmail.values()) bucket(email);

  /**
   * Group rows bill to the group owner: Family sells a pooled allowance, and
   * charging the uploader would spend their personal free tier on it instead.
   */
  const subjectFor = (row: OwnedRow, label: string): string | undefined => {
    const groupId = row.groupId ? String(row.groupId) : undefined;
    if (groupId) {
      const group = groupsById.get(groupId);
      if (group?.owner) return group.owner;
      // The group is gone but its rows are not. The uploader is the only
      // identity left, and dropping the bytes would understate real storage.
      const uploader = userIdToEmail.get(String(row.userId));
      warnings.push(`${label} ${row._id} references missing group ${groupId}; billing to uploader=${uploader ?? 'UNATTRIBUTED'}`);
      return uploader;
    }
    const owner = userIdToEmail.get(String(row.userId));
    if (!owner) warnings.push(`${label} ${row._id} has userId=${row.userId}, which matches no user; UNATTRIBUTED`);
    return owner;
  };

  // --- storageBytes ---------------------------------------------------------
  // Summed from the photos themselves rather than from the denormalized
  // Album.totalSize: that counter is what a drifting $inc would have corrupted,
  // so reconciling against it would re-import the drift instead of fixing it.
  const photoTotals = await db
    .collection('photos')
    .aggregate<{ _id: unknown; totalSize: number; photoCount: number }>(
      [{ $group: { _id: '$albumId', totalSize: { $sum: '$size' }, photoCount: { $sum: 1 } } }],
      { allowDiskUse: true }
    )
    .toArray();
  const sizeByAlbum = new Map(photoTotals.map(row => [String(row._id), row.totalSize || 0]));

  const albums = (await db
    .collection('albums')
    .find({}, { projection: { userId: 1, groupId: 1, totalSize: 1, name: 1 } })
    .toArray()) as unknown as (OwnedRow & { totalSize?: number; name?: string })[];
  const albumIds = new Set(albums.map(a => String(a._id)));

  for (const album of albums) {
    const realSize = sizeByAlbum.get(String(album._id)) ?? 0;
    if ((album.totalSize ?? 0) !== realSize) {
      warnings.push(
        `album ${album._id} ("${album.name}") totalSize=${album.totalSize} but photos sum to ${realSize}; ` +
          `metering the photo sum. The album counter is left alone — it is album-service's to maintain, ` +
          `and silently rewriting another service's denormalized field would hide the bug rather than surface it.`
      );
    }
    const subject = subjectFor(album, 'album');
    if (subject) bucket(subject).storageBytes += realSize;
  }

  for (const row of photoTotals) {
    if (!albumIds.has(String(row._id))) {
      warnings.push(`${row.photoCount} photo(s) totalling ${row.totalSize} B reference missing album ${row._id}; UNATTRIBUTED`);
    }
  }

  // --- trackedTickers -------------------------------------------------------
  // Distinct symbols, not rows: the daily Alpha Vantage spend this limit
  // recovers is one call per distinct active symbol, however many rows hold it.
  const tickers = (await db
    .collection('trackedtickers')
    .find({ isActive: true }, { projection: { userId: 1, groupId: 1, ticker: 1 } })
    .toArray()) as unknown as (OwnedRow & { ticker?: string })[];

  for (const ticker of tickers) {
    const subject = subjectFor(ticker, 'trackedTicker');
    if (subject && ticker.ticker) bucket(subject).trackedTickers.add(String(ticker.ticker).toUpperCase());
  }

  // --- seats ----------------------------------------------------------------
  // Distinct people across every live group the subject owns. Soft-deleted
  // groups are skipped: unlike storage and tickers they cost nothing and grant
  // nobody access, so charging for them would charge for nothing.
  for (const { doc, owner, deleted } of groupsById.values()) {
    if (deleted || !owner) continue;
    const seats = bucket(owner).seats;
    for (const member of doc.members ?? []) {
      const email = normalizeEmail(member.email);
      if (email) seats.add(email);
    }
  }

  return { expected, warnings, scannedUsers: users.length };
}

/**
 * Recompute every derived meter and, with `apply`, write back the ones that
 * disagree.
 *
 * Idempotent: it computes absolute values and writes only differences, so a
 * second run in a row is a no-op.
 */
export async function reconcileUsageMeters(options: ReconcileOptions = {}): Promise<ReconcileReport> {
  const { apply = false, subject: only } = options;
  const onlySubject = normalizeEmail(only);

  const { expected, warnings, scannedUsers } = await computeExpected();

  const current = await UsageMeter.find({ meter: { $in: RECONCILED_METERS }, period: 'ALL' }).lean();
  const currentByKey = new Map(current.map(doc => [`${normalizeEmail(doc.subjectId)}::${doc.meter}`, doc]));

  const subjects = Array.from(expected.keys())
    .filter(email => !onlySubject || email === onlySubject)
    .sort();

  const changes: MeterChange[] = [];
  const ops = [];

  for (const subjectId of subjects) {
    const counts = expected.get(subjectId)!;
    const resolved: Record<MeterKey, number> = {
      storageBytes: counts.storageBytes,
      trackedTickers: counts.trackedTickers.size,
      seats: counts.seats.size
    } as Record<MeterKey, number>;

    for (const meter of RECONCILED_METERS) {
      const to = resolved[meter];
      const existing = currentByKey.get(`${subjectId}::${meter}`);
      const from = existing ? existing.count : null;

      if (from === to) continue;
      // Never create a row just to say zero — absence already reads as zero
      // everywhere. An *existing* row must still be corrected down to zero, or
      // a stale count outlives the data it was counting.
      if (from === null && to === 0) continue;

      changes.push({ subjectId, meter, from, to });
      ops.push({
        updateOne: {
          filter: { subjectId, meter, period: currentPeriod(meter) },
          update: {
            $set: { count: to, updatedAt: new Date() },
            $setOnInsert: { subjectId, meter, period: currentPeriod(meter), createdAt: new Date() }
          },
          upsert: true
        }
      });
    }
  }

  // Meters for subjects the scan no longer recognizes — a removed user, or a
  // subjectId written before an ownership change. Reported, never deleted: a
  // reconciliation that silently drops billing state is worse than the drift.
  const orphanedMeters: OrphanedMeter[] = current
    .filter(doc => !expected.has(normalizeEmail(doc.subjectId) ?? ''))
    .map(doc => ({ subjectId: doc.subjectId, meter: doc.meter, count: doc.count }));

  let written = 0;
  if (apply && ops.length > 0) {
    const result = await UsageMeter.bulkWrite(ops);
    written = result.modifiedCount + result.upsertedCount;
  }

  const expectedRecord: Record<string, Record<MeterKey, number>> = {};
  for (const subjectId of subjects) {
    const counts = expected.get(subjectId)!;
    expectedRecord[subjectId] = {
      storageBytes: counts.storageBytes,
      trackedTickers: counts.trackedTickers.size,
      seats: counts.seats.size
    } as Record<MeterKey, number>;
  }

  return {
    applied: apply,
    scannedUsers,
    subjects: expected.size,
    expected: expectedRecord,
    changes,
    written,
    orphanedMeters,
    warnings
  };
}

/**
 * Run a reconciliation and log the outcome. The scheduled entry point.
 *
 * Never throws: this runs from a cron callback with no caller to catch it, and
 * an unhandled rejection there takes the process down over a housekeeping job.
 */
export async function runUsageReconciliation(): Promise<ReconcileReport | null> {
  const startedAt = Date.now();
  try {
    const report = await reconcileUsageMeters({ apply: true });

    // A correction is drift that already happened — the counter had gone wrong
    // and users were being metered against a wrong number until this ran.
    // Logged at `warn` so a persistent leak in consumeQuota/releaseQuota is
    // visible as a recurring signal rather than buried in an info line.
    const level = report.changes.length > 0 ? 'warn' : 'info';
    logger[level]('entitlement.reconciled', {
      event: 'entitlement.reconciled',
      subjects: report.subjects,
      corrected: report.changes.length,
      written: report.written,
      orphaned: report.orphanedMeters.length,
      warnings: report.warnings.length,
      durationMs: Date.now() - startedAt,
      changes: report.changes.slice(0, 20)
    });

    for (const warning of report.warnings.slice(0, 20)) {
      logger.warn('entitlement.reconcile_warning', { event: 'entitlement.reconcile_warning', detail: warning });
    }

    return report;
  } catch (err) {
    logger.error('Usage meter reconciliation failed', {
      error: (err as Error)?.message,
      durationMs: Date.now() - startedAt
    });
    return null;
  }
}
