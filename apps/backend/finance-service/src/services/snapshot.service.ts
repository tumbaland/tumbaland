import Snapshot, { ISnapshotEntry } from '../models/Snapshot';
import { canAccessResource, ForbiddenError, NotFoundError } from '@tumbaland/backend-core';

/** Parse a YYYY-MM month key into a UTC first-of-month Date. */
export function monthToDate(month: string): Date {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m - 1, 1));
}

export const getSnapshots = async (userId: string, groupId?: string) => {
  const query = groupId
    ? { groupId }
    : { userId, $or: [{ groupId: { $exists: false } }, { groupId: null }] };
  return Snapshot.find(query).sort({ date: -1 });
};

/**
 * Create or replace the snapshot for a month (the monthly check-in).
 * Scoped to the personal or group context the caller is working in.
 */
export const upsertSnapshot = async (
  month: string,
  entries: ISnapshotEntry[],
  userId: string,
  groupId?: string
) => {
  const date = monthToDate(month);

  if (groupId) {
    return Snapshot.findOneAndUpdate(
      { groupId, date },
      { $set: { entries }, $setOnInsert: { userId } },
      { upsert: true, new: true, runValidators: true }
    );
  }

  return Snapshot.findOneAndUpdate(
    { userId, groupId: { $exists: false }, date },
    { $set: { entries } },
    { upsert: true, new: true, runValidators: true }
  );
};

export const deleteSnapshot = async (id: string, userId: string, userGroups: string[] = []) => {
  const snapshot = await Snapshot.findById(id);
  if (!snapshot) {
    throw new NotFoundError('Snapshot not found');
  }

  if (!canAccessResource(userId, snapshot.userId, snapshot.groupId, userGroups, false)) {
    throw new ForbiddenError('Access denied');
  }

  return Snapshot.findByIdAndDelete(id);
};
