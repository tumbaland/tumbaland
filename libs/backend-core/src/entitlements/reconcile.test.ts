jest.mock('../logging/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), http: jest.fn() }
}));

import os from 'os';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import logger from '../logging/logger';
import { UsageMeter } from './UsageMeter';
import { getUsage, setUsage } from './usage';
import { reconcileUsageMeters, runUsageReconciliation } from './reconcile';

/**
 * Against a real Mongo, not mocks: the whole point of this module is the shape
 * of the aggregations and the joins between four services' collections, and a
 * mocked driver would assert nothing about either.
 */
let mongod: MongoMemoryServer;

const OWNER = 'owner@example.com';
const MEMBER = 'member@example.com';
const LONER = 'loner@example.com';

const OWNER_ID = '68987cf71078a6d4d52ba430';
const MEMBER_ID = '689880b91078a6d4d52ba43f';
const LONER_ID = '68b4e9fc05b3c0001a2286c3';
const GROUP_ID = '689a8219e15515e8f6539ad2';

const db = () => mongoose.connection.db!;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  // The driver loads `os` with a dynamic import, which Jest's sandbox refuses, so it is handed over.
  await mongoose.connect(mongod.getUri(), { runtimeAdapters: { os } });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

/** The shape the live database actually has: everything owned through one group. */
async function seed(
  overrides: {
    groups?: unknown[];
    albums?: unknown[];
    photos?: unknown[];
    tickers?: unknown[];
  } = {}
) {
  await db()
    .collection('users')
    .insertMany([
      { _id: new mongoose.Types.ObjectId(OWNER_ID), email: 'Owner@Example.com' },
      { _id: new mongoose.Types.ObjectId(MEMBER_ID), email: MEMBER },
      { _id: new mongoose.Types.ObjectId(LONER_ID), email: LONER }
    ] as never);

  const groups = overrides.groups ?? [
    {
      _id: new mongoose.Types.ObjectId(GROUP_ID),
      name: 'Household',
      createdBy: OWNER,
      members: [
        { email: OWNER, role: 'owner' },
        { email: MEMBER, role: 'admin' }
      ],
      deletedAt: null
    }
  ];
  if (groups.length) await db().collection('groups').insertMany(groups as never);

  const albums = overrides.albums ?? [
    { _id: new mongoose.Types.ObjectId(), userId: OWNER_ID, groupId: GROUP_ID, totalSize: 300, name: 'Shared' },
    { _id: new mongoose.Types.ObjectId(), userId: MEMBER_ID, totalSize: 50, name: 'Personal' }
  ];
  if (albums.length) await db().collection('albums').insertMany(albums as never);

  const photos =
    overrides.photos ??
    (albums as { _id: mongoose.Types.ObjectId }[]).flatMap((album, i) => [
      { albumId: album._id, size: i === 0 ? 200 : 50 },
      ...(i === 0 ? [{ albumId: album._id, size: 100 }] : [])
    ]);
  if ((photos as unknown[]).length) await db().collection('photos').insertMany(photos as never);

  const tickers = overrides.tickers ?? [
    { _id: new mongoose.Types.ObjectId(), userId: OWNER_ID, groupId: GROUP_ID, ticker: 'VWCE.DEX', isActive: true },
    { _id: new mongoose.Types.ObjectId(), userId: OWNER_ID, groupId: GROUP_ID, ticker: 'VUSA.DEX', isActive: true }
  ];
  if ((tickers as unknown[]).length) await db().collection('trackedtickers').insertMany(tickers as never);
}

beforeEach(async () => {
  for (const name of ['users', 'groups', 'albums', 'photos', 'trackedtickers']) {
    await db().collection(name).deleteMany({});
  }
  await UsageMeter.deleteMany({});
  await UsageMeter.syncIndexes();
  jest.clearAllMocks();
});

describe('reconcileUsageMeters', () => {
  it('bills a group album to the owner and a personal album to its own user', async () => {
    await seed();

    const report = await reconcileUsageMeters({ apply: true });

    // 200 + 100 in the shared album, all to the owner; the member keeps only
    // their own 50, rather than the shared bytes landing on their free tier.
    expect(report.expected[OWNER].storageBytes).toBe(300);
    expect(report.expected[MEMBER].storageBytes).toBe(50);
    expect(await getUsage(OWNER, 'storageBytes')).toBe(300);
    expect(await getUsage(MEMBER, 'storageBytes')).toBe(50);
  });

  it('joins userId to email through the users collection, matching on lowercase', async () => {
    await seed();

    await reconcileUsageMeters({ apply: true });

    // The seeded user has a capitalised address; meters are keyed lowercase, so
    // a missed normalization would open a second counter instead of filling one.
    expect(await getUsage('owner@example.com', 'storageBytes')).toBe(300);
    expect(await UsageMeter.countDocuments({ meter: 'storageBytes' })).toBe(2);
  });

  it('counts distinct active symbols, not rows', async () => {
    await seed({
      tickers: [
        { _id: new mongoose.Types.ObjectId(), userId: OWNER_ID, groupId: GROUP_ID, ticker: 'VWCE.DEX', isActive: true },
        // Same symbol held personally as well — one Alpha Vantage call covers both.
        { _id: new mongoose.Types.ObjectId(), userId: OWNER_ID, ticker: 'vwce.dex', isActive: true },
        { _id: new mongoose.Types.ObjectId(), userId: OWNER_ID, ticker: 'DEAD.DEX', isActive: false }
      ]
    });

    await reconcileUsageMeters({ apply: true });

    expect(await getUsage(OWNER, 'trackedTickers')).toBe(1);
  });

  it('counts seats as distinct people in the groups a subject owns', async () => {
    await seed();

    await reconcileUsageMeters({ apply: true });

    expect(await getUsage(OWNER, 'seats')).toBe(2);
    // A member is not charged for a group somebody else owns.
    expect(await getUsage(MEMBER, 'seats')).toBe(0);
  });

  it('keeps billing a soft-deleted group storage and tickers, but not seats', async () => {
    await seed({
      groups: [
        {
          _id: new mongoose.Types.ObjectId(GROUP_ID),
          name: 'Household',
          createdBy: OWNER,
          members: [
            { email: OWNER, role: 'owner' },
            { email: MEMBER, role: 'admin' }
          ],
          deletedAt: new Date('2026-01-01')
        }
      ]
    });

    await reconcileUsageMeters({ apply: true });

    // The photos are still in MinIO and the tickers are still fetched daily;
    // the seats grant nobody access to anything.
    expect(await getUsage(OWNER, 'storageBytes')).toBe(300);
    expect(await getUsage(OWNER, 'trackedTickers')).toBe(2);
    expect(await getUsage(OWNER, 'seats')).toBe(0);
  });

  it('prefers the owner role over a stale createdBy', async () => {
    await seed({
      groups: [
        {
          _id: new mongoose.Types.ObjectId(GROUP_ID),
          name: 'Household',
          createdBy: LONER,
          members: [
            { email: OWNER, role: 'owner' },
            { email: MEMBER, role: 'admin' }
          ],
          deletedAt: null
        }
      ]
    });

    await reconcileUsageMeters({ apply: true });

    expect(await getUsage(OWNER, 'storageBytes')).toBe(300);
    expect(await getUsage(LONER, 'storageBytes')).toBe(0);
  });

  it('writes nothing without apply', async () => {
    await seed();

    const report = await reconcileUsageMeters();

    expect(report.changes.length).toBeGreaterThan(0);
    expect(report.written).toBe(0);
    expect(await UsageMeter.countDocuments({})).toBe(0);
  });

  it('is idempotent — a second run in a row changes nothing', async () => {
    await seed();

    await reconcileUsageMeters({ apply: true });
    const second = await reconcileUsageMeters({ apply: true });

    expect(second.changes).toEqual([]);
    expect(second.written).toBe(0);
  });

  it('repairs a leaked increment, which is the whole reason it is scheduled', async () => {
    await seed();
    // A crash between writing the photo and updating the meter, or a release
    // that never ran: the counter says more than the photos do.
    await setUsage(OWNER, 'storageBytes', 999999);

    const report = await reconcileUsageMeters({ apply: true });

    expect(await getUsage(OWNER, 'storageBytes')).toBe(300);
    expect(report.changes).toContainEqual({ subjectId: OWNER, meter: 'storageBytes', from: 999999, to: 300 });
  });

  it('corrects an existing counter down to zero but never creates a zero row', async () => {
    await seed({ albums: [], photos: [], tickers: [] });
    await setUsage(OWNER, 'storageBytes', 500);

    await reconcileUsageMeters({ apply: true });

    expect(await getUsage(OWNER, 'storageBytes')).toBe(0);
    // The other users had no counter and no usage — nothing was invented.
    expect(await UsageMeter.countDocuments({ subjectId: LONER })).toBe(0);
  });

  it('reports meters for unknown subjects instead of deleting them', async () => {
    await seed();
    await setUsage('ghost@example.com', 'storageBytes', 42);

    const report = await reconcileUsageMeters({ apply: true });

    expect(report.orphanedMeters).toEqual([{ subjectId: 'ghost@example.com', meter: 'storageBytes', count: 42 }]);
    expect(await getUsage('ghost@example.com', 'storageBytes')).toBe(42);
  });

  it('scopes to one subject when asked, leaving everyone else untouched', async () => {
    await seed();
    await setUsage(MEMBER, 'storageBytes', 777);

    await reconcileUsageMeters({ apply: true, subject: 'Owner@Example.com' });

    expect(await getUsage(OWNER, 'storageBytes')).toBe(300);
    expect(await getUsage(MEMBER, 'storageBytes')).toBe(777);
  });

  it('never touches aiJobs, which has no source data to recompute from', async () => {
    await seed();
    await setUsage(OWNER, 'aiJobs', 17);

    await reconcileUsageMeters({ apply: true });

    expect(await getUsage(OWNER, 'aiJobs')).toBe(17);
  });

  it('bills an album in a vanished group to its uploader rather than losing the bytes', async () => {
    await seed({ groups: [] });

    const report = await reconcileUsageMeters({ apply: true });

    expect(await getUsage(OWNER, 'storageBytes')).toBe(300);
    expect(report.warnings.some(w => w.includes('references missing group'))).toBe(true);
  });

  it('warns when a denormalized album counter disagrees, without rewriting it', async () => {
    const albumId = new mongoose.Types.ObjectId();
    await seed({
      albums: [{ _id: albumId, userId: MEMBER_ID, totalSize: 9999, name: 'Drifted' }],
      photos: [{ albumId, size: 50 }],
      tickers: []
    });

    const report = await reconcileUsageMeters({ apply: true });

    expect(await getUsage(MEMBER, 'storageBytes')).toBe(50);
    expect(report.warnings.some(w => w.includes('but photos sum to 50'))).toBe(true);
    const album = await db().collection('albums').findOne({ _id: albumId });
    expect(album?.totalSize).toBe(9999);
  });
});

describe('runUsageReconciliation', () => {
  it('applies, and logs a correction at warn so a persistent leak is visible', async () => {
    await seed();
    // Settle first, so the only change the scheduled run sees is the drift.
    await reconcileUsageMeters({ apply: true });
    await setUsage(OWNER, 'storageBytes', 999999);
    jest.clearAllMocks();

    const report = await runUsageReconciliation();

    expect(report?.written).toBe(1);
    expect(await getUsage(OWNER, 'storageBytes')).toBe(300);
    expect(logger.warn).toHaveBeenCalledWith('entitlement.reconciled', expect.objectContaining({ corrected: 1 }));
  });

  it('logs at info when nothing drifted', async () => {
    await seed();
    await reconcileUsageMeters({ apply: true });
    jest.clearAllMocks();

    await runUsageReconciliation();

    expect(logger.info).toHaveBeenCalledWith('entitlement.reconciled', expect.objectContaining({ corrected: 0 }));
  });

  it('swallows a failure rather than taking the process down from a cron callback', async () => {
    const spy = jest.spyOn(UsageMeter, 'find').mockImplementationOnce(() => {
      throw new Error('mongo is gone');
    });
    await seed();

    await expect(runUsageReconciliation()).resolves.toBeNull();
    expect(logger.error).toHaveBeenCalledWith('Usage meter reconciliation failed', expect.anything());

    spy.mockRestore();
  });
});
