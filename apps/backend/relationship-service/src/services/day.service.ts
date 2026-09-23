import mongoose from 'mongoose';
import { BadRequestError, ForbiddenError, escapeRegex } from '@tumbaland/backend-core';
import { Activity, IActivity, IActivityLocation } from '../models/Activity';
import { ActivityType, IActivityType } from '../models/ActivityType';
import { DAY_PATTERN, parseDay } from '../utils/day';

interface ActivityScopeQuery {
  groupId?: string;
  userId?: string;
  typeId?: mongoose.Types.ObjectId;
  description?: Record<string, unknown>;
  date?: { $gte?: Date; $lte?: Date };
  $or?: Record<string, unknown>[];
}

export interface DayEntryInput {
  _id?: string;
  typeId: string;
  description?: string;
  hours?: number;
  /** null clears a previously saved place; undefined leaves it untouched on create */
  location?: IActivityLocation | null;
}

/** An activity entry with its type populated for rendering. */
export interface DayEntry extends IActivity {
  type?: IActivityType;
}

export interface Day {
  date: string; // YYYY-MM-DD
  entries: DayEntry[];
}

/** Parse a YYYY-MM-DD key into the UTC-midnight Date used for storage. */
export function dayToDate(day: string): Date {
  if (!DAY_PATTERN.test(day)) {
    throw new BadRequestError('Date must be formatted as YYYY-MM-DD');
  }
  // A day that does not exist, like 2026-02-31, must not roll over to 3 March:
  // saving a day replaces its entries, so that would silently delete whatever
  // was logged on 3 March.
  const date = parseDay(day);
  if (!date) throw new BadRequestError('Invalid date');
  return date;
}

/** Entries visible in one scope: a whole group, or a user's non-group entries. */
export function scopeQuery(userId: string, groupId?: string): ActivityScopeQuery {
  return groupId
    ? { groupId }
    : { userId, $or: [{ groupId: { $exists: false } }, { groupId: null }] };
}

interface DayFacetResult {
  days: { _id: Date; entries: DayEntry[] }[];
  totalCount: { count: number }[];
}

/**
 * List days (newest first) with their entries, paginated by day.
 * Entries carry a populated `type` object for rendering.
 */
export const getDays = async (options: {
  userId: string;
  userGroupIds: string[];
  groupId?: string;
  page?: number;
  limit?: number;
  typeId?: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<{ days: Day[]; total: number; page: number; totalPages: number }> => {
  const { userId, userGroupIds, groupId, page = 1, limit = 30, typeId, search, startDate, endDate } = options;

  if (groupId && !userGroupIds.includes(groupId)) {
    throw new ForbiddenError('Access denied');
  }

  const match: ActivityScopeQuery = scopeQuery(userId, groupId);
  if (typeId) match.typeId = new mongoose.Types.ObjectId(typeId);
  if (search) match.description = { $regex: escapeRegex(search), $options: 'i' };
  if (startDate || endDate) {
    match.date = {};
    if (startDate) match.date.$gte = startDate;
    if (endDate) match.date.$lte = endDate;
  }

  const [result] = await Activity.aggregate<DayFacetResult>([
    { $match: match },
    { $sort: { date: -1, createdAt: 1 } },
    {
      $lookup: {
        from: 'activity_types',
        localField: 'typeId',
        foreignField: '_id',
        as: 'type'
      }
    },
    { $unwind: { path: '$type', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: '$date',
        entries: { $push: '$$ROOT' }
      }
    },
    { $sort: { _id: -1 } },
    {
      $facet: {
        days: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        totalCount: [{ $count: 'count' }]
      }
    }
  ]);

  const total = result.totalCount[0]?.count || 0;
  const days: Day[] = result.days.map((d) => ({
    date: d._id.toISOString().slice(0, 10),
    entries: d.entries
  }));

  return { days, total, page, totalPages: Math.ceil(total / limit) };
};

/**
 * Create/replace a day's entries in one call (the day editor's save).
 * Entries with a matching _id are updated, new ones created, and existing
 * entries missing from the list are deleted. An empty list clears the day.
 */
export const saveDay = async (
  day: string,
  entries: DayEntryInput[],
  userId: string,
  userGroupIds: string[],
  groupId?: string
): Promise<Day> => {
  if (groupId && !userGroupIds.includes(groupId)) {
    throw new ForbiddenError('Access denied');
  }

  const date = dayToDate(day);
  const scope = scopeQuery(userId, groupId);

  const existing = await Activity.find({ ...scope, date });
  const existingById = new Map(existing.map((a) => [String(a._id), a]));

  // Every referenced type must exist and belong to the same scope as the day.
  //
  // "Any type the caller can reach" is not the same test: it let a personal type
  // be recorded against inside a group, producing entries the rest of the group
  // cannot see and that break when the owner deletes the type. Scope equality is
  // the rule; `scripts/migration/regroup-activity-types.js` moves the rows that
  // predate it.
  const typeIds = [...new Set(entries.map((e) => e.typeId))];
  const locationTypeIds = new Set<string>();
  if (typeIds.length > 0) {
    const found = await ActivityType.find({ _id: { $in: typeIds } }).select(
      '_id hasLocation userId groupId'
    );
    const byId = new Map(found.map((type) => [String(type._id), type]));

    const inScope = (type: IActivityType): boolean =>
      groupId ? type.groupId === groupId : !type.groupId && type.userId === userId;

    for (const entry of entries) {
      const type = byId.get(entry.typeId);
      if (!type) {
        throw new BadRequestError('Invalid or inaccessible activity type');
      }
      if (inScope(type)) continue;

      // An entry that already exists and is not changing type is tolerated, so a
      // day holding not-yet-migrated rows stays editable instead of refusing
      // every save. Nothing new may be created out of scope.
      const current = entry._id ? existingById.get(entry._id) : undefined;
      if (!current || String(current.typeId) !== entry.typeId) {
        throw new BadRequestError('Invalid or inaccessible activity type');
      }
    }

    for (const type of found) {
      if (type.hasLocation) locationTypeIds.add(String(type._id));
    }
  }

  // A place is only meaningful on a type that opts in; silently storing one on
  // a type the editor never shows a picker for would strand it on the map.
  const strayLocation = entries.find((e) => e.location && !locationTypeIds.has(e.typeId));
  if (strayLocation) {
    throw new BadRequestError('This activity type does not accept a location');
  }

  const keptIds = new Set(entries.filter((e) => e._id).map((e) => e._id!));
  const toDelete = existing.filter((a) => !keptIds.has(String(a._id)));
  if (toDelete.length > 0) {
    await Activity.deleteMany({ _id: { $in: toDelete.map((a) => a._id) } });
  }

  for (const entry of entries) {
    const description = entry.description?.trim() || undefined;
    const hours = entry.hours ?? undefined;
    const location = entry.location
      ? {
          label: entry.location.label.trim(),
          lat: entry.location.lat,
          lng: entry.location.lng
        }
      : undefined;

    if (entry._id && existingById.has(entry._id)) {
      const $set: Partial<Pick<IActivity, 'typeId' | 'description' | 'hours' | 'location'>> = { typeId: entry.typeId as unknown as IActivity['typeId'] };
      const $unset: Partial<Record<'description' | 'hours' | 'location', ''>> = {};
      if (description === undefined) $unset.description = '';
      else $set.description = description;
      if (hours === undefined) $unset.hours = '';
      else $set.hours = hours;
      if (location === undefined) $unset.location = '';
      else $set.location = location;

      await Activity.findByIdAndUpdate(
        entry._id,
        { $set, ...(Object.keys($unset).length ? { $unset } : {}) },
        { runValidators: true }
      );
    } else {
      await new Activity({
        date,
        typeId: entry.typeId,
        ...(description !== undefined ? { description } : {}),
        ...(hours !== undefined ? { hours } : {}),
        ...(location !== undefined ? { location } : {}),
        userId,
        ...(groupId ? { groupId } : {})
      }).save();
    }
  }

  // Return the fresh day in the same shape getDays produces (raw typeId + populated type)
  const saved = await Activity.find({ ...scope, date }).populate<{ typeId: IActivityType }>('typeId').sort({ createdAt: 1 });
  return {
    date: day,
    entries: saved.map((doc): DayEntry => {
      const obj = doc.toObject();
      const { typeId, ...rest } = obj;
      if (typeId && typeof typeId === 'object' && '_id' in typeId) {
        return { ...rest, type: typeId, typeId: typeId._id } as unknown as DayEntry;
      }
      return { ...rest, typeId } as unknown as DayEntry;
    })
  };
};
