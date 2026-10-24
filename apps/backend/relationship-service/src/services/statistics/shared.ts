import { PipelineStage } from 'mongoose';
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

/**
 * The entries in scope, within `year` when one is given. The year runs from UTC
 * midnight to UTC midnight, because that is how entries are stored and how the
 * aggregations bucket them.
 */
export function matchFor(year: number | undefined, filters: StatisticsFilters): ActivityMatchConditions {
  const conditions: ActivityMatchConditions = {};
  if (year) {
    conditions.date = { $gte: new Date(Date.UTC(year, 0, 1)), $lt: new Date(Date.UTC(year + 1, 0, 1)) };
  }
  return Object.assign(conditions, accessQueryFor(filters));
}

/**
 * The opening stages of a per-type aggregation: the entries `matchFor` picks,
 * each joined to its type as `activityType`. An entry whose type is gone drops out.
 */
export const typedActivityStages = (year: number | undefined, filters: StatisticsFilters): PipelineStage[] => [
  { $match: matchFor(year, filters) },
  { $lookup: { from: 'activity_types', localField: 'typeId', foreignField: '_id', as: 'activityType' } },
  { $unwind: '$activityType' }
];

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole days since the epoch for a YYYY-MM-DD key — consecutive days differ by 1. */
export function dayNumber(dayKey: string): number {
  return Math.floor(Date.parse(`${dayKey}T00:00:00.000Z`) / MS_PER_DAY);
}

export const dayKeyOf = (dayNum: number): string => new Date(dayNum * MS_PER_DAY).toISOString().slice(0, 10);

export const toDayKey = (date: Date): string => new Date(date).toISOString().slice(0, 10);
