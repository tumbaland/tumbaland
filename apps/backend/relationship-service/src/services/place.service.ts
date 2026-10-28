import mongoose from 'mongoose';
import { assertMemberOf } from '@tumbaland/backend-core';
import { Activity } from '../models/Activity';
import { scopeQuery } from './day.service';

/** Coordinate precision used to fold repeat visits into one pin (~11 m). */
const COORD_PRECISION = 4;

interface PlaceMatch {
  groupId?: string;
  userId?: string;
  typeId?: mongoose.Types.ObjectId;
  date?: { $gte?: Date; $lte?: Date };
  location?: Record<string, unknown>;
  $or?: Record<string, unknown>[];
}

interface PlaceAggRow {
  _id: { label: string; lat: number; lng: number };
  label: string;
  lat: number;
  lng: number;
  visits: number;
  firstVisit: Date;
  lastVisit: Date;
  types: {
    typeId: mongoose.Types.ObjectId;
    name: string;
    slug: string;
    color?: string;
  }[];
}

export interface PlaceTypeBreakdown {
  typeId: string;
  name: string;
  slug: string;
  color?: string;
  count: number;
}

export interface Place {
  /** stable id for React keys and pin identity: rounded coords + label */
  id: string;
  label: string;
  lat: number;
  lng: number;
  visits: number;
  /** YYYY-MM-DD */
  firstVisit: string;
  /** YYYY-MM-DD */
  lastVisit: string;
  types: PlaceTypeBreakdown[];
}

/**
 * Every distinct place in a scope, with how often and when it was visited.
 *
 * Visits fold together by rounded coordinates rather than by label, so a place
 * re-picked from the geocoder with a slightly different name still lands on one
 * pin. The label shown is the one from the most recent visit.
 */
export const getPlaces = async (options: {
  userId: string;
  userGroupIds: string[];
  groupId?: string;
  typeId?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<Place[]> => {
  const { userId, userGroupIds, groupId, typeId, startDate, endDate } = options;

  assertMemberOf(groupId, userGroupIds);

  const match: PlaceMatch = {
    ...scopeQuery(userId, groupId),
    location: { $exists: true, $ne: null }
  };
  if (typeId) match.typeId = new mongoose.Types.ObjectId(typeId);
  if (startDate || endDate) {
    match.date = {};
    if (startDate) match.date.$gte = startDate;
    if (endDate) match.date.$lte = endDate;
  }

  const rounded = (field: string) => ({
    $round: [`$location.${field}`, COORD_PRECISION]
  });

  const rows = await Activity.aggregate<PlaceAggRow>([
    { $match: match },
    { $sort: { date: -1 } },
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
        _id: { lat: rounded('lat'), lng: rounded('lng') },
        // sorted newest-first above, so $first is the most recent naming
        label: { $first: '$location.label' },
        lat: { $first: '$location.lat' },
        lng: { $first: '$location.lng' },
        visits: { $sum: 1 },
        firstVisit: { $min: '$date' },
        lastVisit: { $max: '$date' },
        types: {
          $push: {
            typeId: '$type._id',
            name: '$type.name',
            slug: '$type.slug',
            color: '$type.color'
          }
        }
      }
    },
    { $sort: { visits: -1, lastVisit: -1 } }
  ]);

  return rows.map((row) => {
    const byType = new Map<string, PlaceTypeBreakdown>();
    for (const type of row.types) {
      if (!type?.typeId) continue; // entry whose type was deleted
      const key = String(type.typeId);
      const existing = byType.get(key);
      if (existing) existing.count += 1;
      else
        byType.set(key, {
          typeId: key,
          name: type.name,
          slug: type.slug,
          color: type.color,
          count: 1
        });
    }

    return {
      id: `${row._id.lat},${row._id.lng}`,
      label: row.label,
      lat: row.lat,
      lng: row.lng,
      visits: row.visits,
      firstVisit: row.firstVisit.toISOString().slice(0, 10),
      lastVisit: row.lastVisit.toISOString().slice(0, 10),
      types: [...byType.values()].sort((a, b) => b.count - a.count)
    };
  });
};

export interface PlaceVisit {
  /** YYYY-MM-DD */
  date: string;
  typeId: string;
  typeName?: string;
  typeColor?: string;
  description?: string;
  hours?: number;
}

/**
 * Individual visits to one place, newest first — the pin popup's detail list.
 * Matched on rounded coordinates, the same key `getPlaces` groups by.
 */
export const getPlaceVisits = async (options: {
  userId: string;
  userGroupIds: string[];
  groupId?: string;
  lat: number;
  lng: number;
  limit?: number;
}): Promise<PlaceVisit[]> => {
  const { userId, userGroupIds, groupId, lat, lng, limit = 50 } = options;

  assertMemberOf(groupId, userGroupIds);

  // Half a rounding step either side reproduces $round's bucket as a range,
  // which an index can serve; $round in a $match could not.
  const halfStep = 0.5 / 10 ** COORD_PRECISION;

  const rows = await Activity.find({
    ...scopeQuery(userId, groupId),
    'location.lat': { $gte: lat - halfStep, $lte: lat + halfStep },
    'location.lng': { $gte: lng - halfStep, $lte: lng + halfStep }
  })
    .populate<{ typeId: { _id: mongoose.Types.ObjectId; name: string; color?: string } }>('typeId', 'name color')
    .sort({ date: -1 })
    .limit(limit);

  return rows.map((row) => {
    const type = row.typeId as unknown as { _id: mongoose.Types.ObjectId; name?: string; color?: string } | null;
    return {
      date: new Date(row.date).toISOString().slice(0, 10),
      typeId: String(type?._id ?? row.typeId),
      typeName: type?.name,
      typeColor: type?.color,
      ...(row.description !== undefined ? { description: row.description } : {}),
      ...(row.hours !== undefined ? { hours: row.hours } : {})
    };
  });
};
