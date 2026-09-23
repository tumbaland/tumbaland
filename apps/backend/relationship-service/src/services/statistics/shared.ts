import { buildAccessQuery } from '@tumbaland/backend-core';

export interface ActivityMatchConditions {
  date?: { $gte?: Date; $lt?: Date };
  groupId?: string | null;
  userId?: string;
  $or?: Record<string, unknown>[];
}

export interface StatisticsFilters {
  userId?: string;
  userGroupIds?: string[];
  groupId?: string;
  personalOnly?: boolean;
}

/**
 * The scope half of a statistics match: one group, one user's non-group entries,
 * or — when neither is asked for — everything the user can reach.
 */
export function accessQueryFor(filters: StatisticsFilters): Record<string, unknown> {
  const { userId, userGroupIds = [], groupId, personalOnly } = filters;

  if (groupId) {
    return { groupId };
  }
  if (personalOnly) {
    // Personal context: only entries carrying no group at all.
    return {
      userId,
      $or: [{ groupId: null }, { groupId: { $exists: false } }]
    };
  }
  if (userId) {
    return buildAccessQuery(userId, userGroupIds, false);
  }
  return {};
}

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole days since the epoch for a YYYY-MM-DD key — consecutive days differ by 1. */
export function dayNumber(dayKey: string): number {
  return Math.floor(Date.parse(`${dayKey}T00:00:00.000Z`) / MS_PER_DAY);
}

export const dayKeyOf = (dayNum: number): string => new Date(dayNum * MS_PER_DAY).toISOString().slice(0, 10);

export const toDayKey = (date: Date): string => new Date(date).toISOString().slice(0, 10);
