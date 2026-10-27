import { UserDay } from '@tumbaland/backend-core';
import { AdminActivity, AdminAlbum, AdminGroup, AdminUser, type AdminUserDoc } from '../models/readModels';
import { storageUsed } from './quota';
import { displayName } from './usersService';

export interface DeletionEntry {
  id: string;
  email: string;
  name: string | null;
  requestedAt: string | null;
  /** Set once an administrator has closed the account. */
  confirmedAt: string | null;
  /** The administrator, by email. */
  confirmedBy: string | null;
  /** Last time they opened the app, if ever. */
  lastVisitAt: string | null;
  /** They opened the app after asking: worth a message before closing, in case it was a slip. */
  visitedSinceRequest: boolean;
  /** Groups they are in, and who else is in them: what the people left behind keep. */
  groups: Array<{ name: string; role: string; otherMembers: string[] }>;
  /** What they own, as counts. This is what is still there to be removed by hand. */
  owns: { albums: number; photos: number; activities: number; storageBytes: number };
}

export interface Deletions {
  requested: DeletionEntry[];
  /** Closed and not yet removed: the manual clean-up list. */
  closed: DeletionEntry[];
}

type Row = Pick<
  AdminUserDoc,
  '_id' | 'email' | 'firstName' | 'lastName' | 'googleName' | 'deletionRequestedAt' | 'deletionConfirmedAt' | 'deletionConfirmedBy'
>;

const FIELDS = {
  email: 1,
  firstName: 1,
  lastName: 1,
  googleName: 1,
  deletionRequestedAt: 1,
  deletionConfirmedAt: 1,
  deletionConfirmedBy: 1
};

async function describeAccounts(rows: Row[]): Promise<DeletionEntry[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => String(row._id));
  const emails = rows.map((row) => row.email);

  const adminIds = rows.map((row) => row.deletionConfirmedBy).filter((id): id is string => Boolean(id));
  const [lastVisits, groups, albums, activities, storage, admins] = await Promise.all([
    UserDay.aggregate<{ _id: string; lastAt: Date }>([
      { $match: { userId: { $in: ids } } },
      { $group: { _id: '$userId', lastAt: { $max: '$lastAt' } } }
    ]),
    AdminGroup.find({ 'members.email': { $in: emails }, deletedAt: null }, { name: 1, members: 1 }).lean(),
    AdminAlbum.aggregate<{ _id: string; albums: number; photos: number }>([
      { $match: { userId: { $in: ids } } },
      { $group: { _id: '$userId', albums: { $sum: 1 }, photos: { $sum: '$photoCount' } } }
    ]),
    AdminActivity.aggregate<{ _id: string; count: number }>([
      { $match: { userId: { $in: ids } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } }
    ]),
    storageUsed(emails),
    AdminUser.find({ _id: { $in: adminIds } }, { email: 1 }).lean()
  ]);

  const visitOf = new Map(lastVisits.map((row) => [row._id, row.lastAt]));
  const albumsOf = new Map(albums.map((row) => [row._id, row]));
  const activitiesOf = new Map(activities.map((row) => [row._id, row.count]));
  const adminEmail = new Map(admins.map((admin) => [String(admin._id), admin.email]));

  return rows.map((row): DeletionEntry => {
    const id = String(row._id);
    const lastVisit = visitOf.get(id) ?? null;
    return {
      id,
      email: row.email,
      name: displayName(row),
      requestedAt: row.deletionRequestedAt?.toISOString() ?? null,
      confirmedAt: row.deletionConfirmedAt?.toISOString() ?? null,
      confirmedBy: row.deletionConfirmedBy ? (adminEmail.get(row.deletionConfirmedBy) ?? null) : null,
      lastVisitAt: lastVisit?.toISOString() ?? null,
      visitedSinceRequest: Boolean(lastVisit && row.deletionRequestedAt && lastVisit > row.deletionRequestedAt),
      groups: groups
        .filter((group) => group.members.some((member) => member.email === row.email))
        .map((group) => ({
          name: group.name,
          role: group.members.find((member) => member.email === row.email)?.role ?? 'member',
          otherMembers: group.members.map((member) => member.email).filter((email) => email !== row.email)
        })),
      owns: {
        albums: albumsOf.get(id)?.albums ?? 0,
        photos: albumsOf.get(id)?.photos ?? 0,
        activities: activitiesOf.get(id) ?? 0,
        storageBytes: storage.get(row.email.toLowerCase()) ?? 0
      }
    };
  });
}

/**
 * The deletion queue: who asked, and who has been closed and still has data.
 *
 * Counts only. What a person owns is shown as how many albums, photos and
 * entries there are and how many bytes, never what is in them.
 */
export async function getDeletions(): Promise<Deletions> {
  const [requested, closed] = await Promise.all([
    AdminUser.find({ deletionRequestedAt: { $ne: null }, deletionConfirmedAt: null }, FIELDS)
      .sort({ deletionRequestedAt: 1 })
      .lean(),
    AdminUser.find({ deletionConfirmedAt: { $ne: null } }, FIELDS).sort({ deletionConfirmedAt: -1 }).lean()
  ]);
  const [requestedEntries, closedEntries] = await Promise.all([describeAccounts(requested), describeAccounts(closed)]);
  return { requested: requestedEntries, closed: closedEntries };
}

