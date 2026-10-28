import { Types } from 'mongoose';
import { assertMemberOf } from '@tumbaland/backend-core';
import Album from '../models/Album';
import Photo, { IPhoto } from '../models/Photo';
import photoService, { PhotoWithSignedUrls } from './photoService';

export interface MemoriesFilter {
  groupId?: string;
  /** how many days either side of the target day still counts as "this day" */
  windowDays?: number;
  /** how many photos each year contributes to the strip */
  limitPerYear?: number;
  /** the day to look back from; defaults to today */
  now?: Date;
}

export interface MemoriesContext {
  userId: string;
  userGroups: string[];
}

export interface MemoryPhoto extends PhotoWithSignedUrls {
  albumName: string;
  /** the day this photo is remembered on (YYYY-MM-DD) */
  memoryDate: string;
  /** 'taken' when the file carried a capture date, 'uploaded' when it did not */
  dateSource: 'taken' | 'uploaded';
}

export interface MemoryYear {
  year: number;
  yearsAgo: number;
  /** photos this year has in the window — may exceed `photos.length` */
  photoCount: number;
  photos: MemoryPhoto[];
}

export interface MemoriesResult {
  /** the day the window is centred on (YYYY-MM-DD) */
  date: string;
  windowDays: number;
  /** every matching photo, across years, before the per-year cap */
  totalPhotos: number;
  /** most recent year first */
  years: MemoryYear[];
}

interface MemoryYearAggRow {
  _id: number; // the year
  photoCount: number;
  photoIds: Types.ObjectId[];
}

/** A (month, day) the window covers. Year-agnostic — that is the whole point. */
interface MonthDay {
  month: number;
  day: number;
}

/**
 * Where the people are. The server runs in UTC, and for the first two or three
 * hours of a Tallinn day the UTC date is still yesterday's, so "on this day"
 * showed yesterday's memories after midnight.
 */
const TIME_ZONE = 'Europe/Tallinn';

/** Today's date in TIME_ZONE, as the UTC midnight of that calendar day. */
export const localToday = (now: Date, timeZone: string = TIME_ZONE): Date => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(now)
      .map((part) => [part.type, part.value])
  );
  return new Date(Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!));
};

/**
 * The calendar days the window covers, as month/day pairs.
 *
 * Walking real dates rather than doing arithmetic on the day number is what
 * makes the edges correct: a window around 1 January reaches back into
 * December, and one around 1 March reaches back to 29 February. The reference
 * year is a leap year precisely so that last case exists to be found — a photo
 * taken on a leap day would otherwise be unreachable from any window.
 */
export const windowMonthDays = (now: Date, windowDays: number): MonthDay[] => {
  const LEAP_YEAR = 2000;
  const centre = Date.UTC(LEAP_YEAR, now.getUTCMonth(), now.getUTCDate());
  const seen = new Map<string, MonthDay>();

  for (let offset = -windowDays; offset <= windowDays; offset++) {
    const day = new Date(centre + offset * 24 * 60 * 60 * 1000);
    const monthDay = { month: day.getUTCMonth() + 1, day: day.getUTCDate() };
    seen.set(`${monthDay.month}-${monthDay.day}`, monthDay);
  }

  return Array.from(seen.values());
};

class MemoriesService {
  /**
   * Photos from this day in earlier years — the "on this day" strip.
   *
   * Scoped like the dashboard statistics: a group the caller belongs to, or
   * their own non-group albums. The current year is deliberately excluded;
   * something photographed last week is not a memory yet.
   */
  async getMemories(filter: MemoriesFilter, context: MemoriesContext): Promise<MemoriesResult> {
    const { groupId, windowDays = 3, limitPerYear = 12 } = filter;
    const now = localToday(filter.now ?? new Date());
    const { userId, userGroups } = context;

    assertMemberOf(groupId, userGroups, 'Access denied: Not a member of this group');

    const date = now.toISOString().slice(0, 10);
    const albumQuery = groupId ? { groupId } : { userId, groupId: { $exists: false } };
    const albums = await Album.find(albumQuery).select({ name: 1 }).lean<{ _id: unknown; name: string }[]>();

    const empty: MemoriesResult = { date, windowDays, totalPhotos: 0, years: [] };
    if (albums.length === 0) return empty;

    const albumNames = new Map(albums.map((album) => [String(album._id), album.name]));
    // Cast, rather than the string form the name map is keyed by: Mongoose casts
    // a query against the schema but never an aggregation pipeline, so a string
    // here is compared to an ObjectId in the collection and matches nothing.
    const albumIds = albums.map((album) => new Types.ObjectId(String(album._id)));

    // Group into years and keep only the ids — the documents themselves are
    // fetched once below for the capped set, so a day with hundreds of photos
    // never pushes hundreds of documents through the aggregation.
    const yearRows = await Photo.aggregate<MemoryYearAggRow>([
      { $match: { albumId: { $in: albumIds } } },
      {
        $addFields: {
          // A capture date is the honest answer to "when was this?", but plenty
          // of files arrive without one — a screenshot, a scan, anything
          // stripped of EXIF. Falling back to the upload date keeps those
          // photos reachable; `dateSource` below says which one a photo used so
          // the UI never claims more than it knows.
          memoryDate: { $ifNull: ['$metadata.dateTaken', '$createdAt'] }
        }
      },
      {
        $addFields: {
          memoryYear: { $year: '$memoryDate' },
          memoryMonth: { $month: '$memoryDate' },
          memoryDay: { $dayOfMonth: '$memoryDate' }
        }
      },
      {
        $match: {
          memoryYear: { $lt: now.getUTCFullYear() },
          $or: windowMonthDays(now, windowDays).map(({ month, day }) => ({
            memoryMonth: month,
            memoryDay: day
          }))
        }
      },
      { $sort: { memoryDate: -1 as const } },
      { $group: { _id: '$memoryYear', photoCount: { $sum: 1 }, photoIds: { $push: '$_id' } } },
      { $sort: { _id: -1 as const } },
      { $project: { photoCount: 1, photoIds: { $slice: ['$photoIds', limitPerYear] } } }
    ]);

    if (yearRows.length === 0) return empty;

    // One find for every year's capped selection, then one batch of signed URLs
    // for the lot — the cost of the strip does not grow with the years in it.
    const wantedIds = yearRows.flatMap((row) => row.photoIds);
    const documents = await Photo.find({ _id: { $in: wantedIds } });
    const enriched = await photoService.attachSignedUrls(documents);
    const byId = new Map(enriched.map((photo) => [String(photo._id), photo]));

    const currentYear = now.getUTCFullYear();
    const years: MemoryYear[] = yearRows.map((row) => ({
      year: row._id,
      yearsAgo: currentYear - row._id,
      photoCount: row.photoCount,
      // Ordered off the aggregation's ids: `find` returns whatever order the
      // index gives, and the strip reads newest-first within a year.
      photos: row.photoIds
        .map((id) => byId.get(String(id)))
        .filter((photo): photo is PhotoWithSignedUrls => Boolean(photo))
        .map((photo) => this.toMemoryPhoto(photo, albumNames))
    }));

    return {
      date,
      windowDays,
      totalPhotos: yearRows.reduce((sum, row) => sum + row.photoCount, 0),
      years
    };
  }

  /**
   * Private helper: the two things a memory needs beyond a plain photo — the
   * album it came from, and the date it is being remembered on (plus where
   * that date came from).
   */
  private toMemoryPhoto(photo: PhotoWithSignedUrls, albumNames: Map<string, string>): MemoryPhoto {
    const dateTaken = (photo.metadata as IPhoto['metadata'] | undefined)?.dateTaken;

    return {
      ...photo,
      albumName: albumNames.get(String(photo.albumId)) ?? 'Unknown album',
      memoryDate: new Date(dateTaken ?? photo.createdAt).toISOString().slice(0, 10),
      dateSource: dateTaken ? 'taken' : 'uploaded'
    };
  }
}

export default new MemoriesService();
