import { AuditEvent, dayOf, UserDay } from '@tumbaland/backend-core';
import { User } from '../models/User';

export interface BackfillReport {
  /** Days the audit trail and the accounts know a person was there. */
  candidates: number;
  /** Of those, days that already have a row, left exactly as they are. */
  alreadyRecorded: number;
  /** Rows written; zero unless `apply`. */
  written: number;
  applied: boolean;
}

interface Day {
  userId: string;
  day: string;
  firstAt: Date;
  lastAt: Date;
}

const CHUNK = 1000;

/**
 * Fills `user_days` with the days the data already proves someone was active,
 * so the admin screens do not start empty the day tracking ships.
 *
 * Three sources, none of them a visit: a day on which the person wrote
 * something (the audit trail's `person` rows, which reach back a year), the day
 * they signed up, and the day they last signed in. Each is stored as one visit,
 * marked `backfilled`, because that is all it knows. A person who read for an
 * hour and wrote nothing is invisible here, so these days undercount and the
 * screens say so.
 *
 * Safe to run twice: rows are only ever inserted (`$setOnInsert`), so a day that
 * has a real row, or was backfilled before, is not touched.
 */
export async function backfillUserDays({ apply }: { apply: boolean }): Promise<BackfillReport> {
  const days = new Map<string, Day>();
  const keyOf = (userId: string, day: string): string => `${userId}|${day}`;

  const note = (userId: string, at: Date | null | undefined): void => {
    if (!at) return;
    const day = dayOf(at);
    const seen = days.get(keyOf(userId, day));
    if (!seen) {
      days.set(keyOf(userId, day), { userId, day, firstAt: at, lastAt: at });
      return;
    }
    if (at < seen.firstAt) seen.firstAt = at;
    if (at > seen.lastAt) seen.lastAt = at;
  };

  // Only people: an assistant writing at 3am is not someone opening the app.
  const written = await AuditEvent.aggregate<{ _id: { userId: string }; firstAt: Date; lastAt: Date }>([
    { $match: { actorKind: 'person' } },
    {
      $group: {
        _id: {
          userId: '$userId',
          day: { $dateToString: { format: '%Y-%m-%d', date: '$at', timezone: 'UTC' } }
        },
        firstAt: { $min: '$at' },
        lastAt: { $max: '$at' }
      }
    }
  ]);
  for (const row of written) {
    note(row._id.userId, row.firstAt);
    note(row._id.userId, row.lastAt);
  }

  const users = await User.find({}, { createdAt: 1, lastLoginAt: 1 }).lean();
  for (const user of users) {
    note(String(user._id), user.createdAt);
    note(String(user._id), user.lastLoginAt);
  }

  const existing = await UserDay.find({}, { userId: 1, day: 1 }).lean();
  const recorded = new Set(existing.map((row) => keyOf(row.userId, row.day)));
  const missing = [...days.values()].filter((day) => !recorded.has(keyOf(day.userId, day.day)));

  const report: BackfillReport = {
    candidates: days.size,
    alreadyRecorded: days.size - missing.length,
    written: 0,
    applied: apply
  };
  if (!apply) return report;

  for (let start = 0; start < missing.length; start += CHUNK) {
    const result = await UserDay.bulkWrite(
      missing.slice(start, start + CHUNK).map((day) => ({
        updateOne: {
          filter: { userId: day.userId, day: day.day },
          update: { $setOnInsert: { visits: 1, firstAt: day.firstAt, lastAt: day.lastAt, backfilled: true } },
          upsert: true
        }
      })),
      { ordered: false }
    );
    report.written += result.upsertedCount;
  }
  return report;
}
