/**
 * Integration tests against a real MongoDB, not mocks.
 *
 * `tickerPriceHistory.service.test.ts` reports 100% line coverage while mocking
 * Mongoose entirely, and a real upsert bug survived it. Quota code has the same
 * failure mode with worse consequences: a mocked `$inc` always looks correct,
 * and a broken one either gives the product away or bills people for capacity
 * they cannot use. The concurrency tests below are meaningless without a real
 * server — they are the whole reason the atomic reserve is written the way it is.
 */
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

jest.mock('../logging/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), http: jest.fn() }
}));

import logger from '../logging/logger';
import { UsageMeter, currentPeriod } from './UsageMeter';
import { checkQuota, consumeQuota, getUsage, getUsageSnapshot, releaseQuota, setUsage } from './usage';
import { Entitlements } from './types';
import { UNLIMITED, normalizeLimits } from './definitions';

jest.setTimeout(120_000);

let mongod: MongoMemoryServer;

const ORIGINAL_ENV = process.env;

function entitlements(overrides: Partial<Entitlements> = {}): Entitlements {
  return {
    email: 'user@example.com',
    planCode: 'free',
    status: null,
    limits: normalizeLimits({ meters: { aiJobs: 5, storageBytes: 1000, trackedTickers: 3, seats: 1 } }, 'free'),
    upgradeTo: 'personal',
    ...overrides
  };
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  process.env = { ...ORIGINAL_ENV };
  await UsageMeter.deleteMany({});
  // The unique index is what makes the concurrent upserts below collapse onto
  // one document instead of racing into duplicates.
  await UsageMeter.syncIndexes();
  (logger.info as jest.Mock).mockClear();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('consumeQuota', () => {
  it('records usage and allows a request that lands exactly on the limit', async () => {
    await consumeQuota({ subjectId: 'user@example.com', meter: 'aiJobs', amount: 5, entitlements: entitlements() });

    expect(await getUsage('user@example.com', 'aiJobs')).toBe(5);
  });

  it('rejects with a 402 carrying everything the upgrade dialog renders', async () => {
    await setUsage('user@example.com', 'aiJobs', 5);

    await expect(
      consumeQuota({ subjectId: 'user@example.com', meter: 'aiJobs', amount: 1, entitlements: entitlements() })
    ).rejects.toMatchObject({
      statusCode: 402,
      details: { code: 'QUOTA_EXCEEDED', meter: 'aiJobs', used: 5, limit: 5, planCode: 'free', upgradeTo: 'personal' }
    });
  });

  it('rolls its own increment back when it rejects, so a refusal costs the user nothing', async () => {
    await setUsage('user@example.com', 'aiJobs', 5);

    await expect(
      consumeQuota({ subjectId: 'user@example.com', meter: 'aiJobs', entitlements: entitlements() })
    ).rejects.toMatchObject({ statusCode: 402 });

    expect(await getUsage('user@example.com', 'aiJobs')).toBe(5);
  });

  it('admits exactly the limit under concurrency and rejects the rest', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, () =>
        consumeQuota({ subjectId: 'user@example.com', meter: 'aiJobs', entitlements: entitlements() })
      )
    );

    const admitted = results.filter(r => r.status === 'fulfilled');
    expect(admitted).toHaveLength(5);
    // The rejected requests all rolled back, so the counter reflects the
    // admitted ones only — no permanent drift from the losers of the race.
    expect(await getUsage('user@example.com', 'aiJobs')).toBe(5);
  });

  it('never blocks an unlimited meter', async () => {
    const unlimited = entitlements({
      planCode: 'family',
      limits: normalizeLimits({ meters: { trackedTickers: UNLIMITED } }, 'family')
    });

    await consumeQuota({ subjectId: 'user@example.com', meter: 'trackedTickers', amount: 10_000, entitlements: unlimited });

    expect(await getUsage('user@example.com', 'trackedTickers')).toBe(10_000);
  });

  it('counts monthly meters into the calendar month, so usage rolls over', async () => {
    await consumeQuota({ subjectId: 'user@example.com', meter: 'aiJobs', amount: 5, entitlements: entitlements() });

    // A document written under a previous month's bucket must not count.
    const previousMonth = await UsageMeter.findOne({ meter: 'aiJobs' });
    expect(previousMonth?.period).toBe(currentPeriod('aiJobs'));

    await UsageMeter.updateOne({ meter: 'aiJobs' }, { $set: { period: '2001-01' } });
    expect(await getUsage('user@example.com', 'aiJobs')).toBe(0);
    await expect(
      consumeQuota({ subjectId: 'user@example.com', meter: 'aiJobs', entitlements: entitlements() })
    ).resolves.toBeUndefined();
  });

  it('bills the same subject regardless of email casing', async () => {
    await consumeQuota({ subjectId: 'User@Example.com', meter: 'seats', entitlements: entitlements() });

    expect(await getUsage('user@example.com', 'seats')).toBe(1);
  });
});

describe('rejection logging', () => {
  it('logs the block alongside throwing, so an operator sees what a user saw', async () => {
    await setUsage('user@example.com', 'aiJobs', 5);

    await expect(
      consumeQuota({ subjectId: 'user@example.com', meter: 'aiJobs', entitlements: entitlements(), route: '/ai/dispatch' })
    ).rejects.toMatchObject({ statusCode: 402 });

    expect(logger.info).toHaveBeenCalledWith(
      'entitlement.blocked',
      expect.objectContaining({ meter: 'aiJobs', used: 5, limit: 5, route: '/ai/dispatch' })
    );
  });

  it('flags a block that came from stale fallback limits rather than the real plan', async () => {
    await setUsage('user@example.com', 'aiJobs', 5);

    await expect(
      consumeQuota({
        subjectId: 'user@example.com',
        meter: 'aiJobs',
        entitlements: entitlements({ stale: true })
      })
    ).rejects.toMatchObject({ statusCode: 402 });

    // A run of these means payment-service is down and paying users are being
    // held to free limits — a different incident from a limit set too tight.
    expect(logger.info).toHaveBeenCalledWith('entitlement.blocked', expect.objectContaining({ stale: true }));
  });
});

describe('checkQuota', () => {
  it('passes when the requested amount still fits and writes nothing', async () => {
    await setUsage('user@example.com', 'storageBytes', 400);

    await expect(
      checkQuota({ subjectId: 'user@example.com', meter: 'storageBytes', amount: 600, entitlements: entitlements() })
    ).resolves.toBeUndefined();
    expect(await getUsage('user@example.com', 'storageBytes')).toBe(400);
  });

  it('rejects, and writes nothing, when the requested amount would overrun', async () => {
    await setUsage('user@example.com', 'storageBytes', 400);

    await expect(
      checkQuota({ subjectId: 'user@example.com', meter: 'storageBytes', amount: 601, entitlements: entitlements() })
    ).rejects.toMatchObject({ statusCode: 402 });

    // Read-only by contract: the increment belongs to the point the resource
    // actually comes into existence, not to the gate in front of it.
    expect(await getUsage('user@example.com', 'storageBytes')).toBe(400);
    expect(logger.info).toHaveBeenCalledWith(
      'entitlement.blocked',
      expect.objectContaining({ meter: 'storageBytes', used: 400, limit: 1000 })
    );
  });

  it('skips the usage read entirely for an unlimited meter', async () => {
    const unlimited = entitlements({ limits: normalizeLimits({ meters: { storageBytes: UNLIMITED } }, 'free') });

    await expect(
      checkQuota({ subjectId: 'user@example.com', meter: 'storageBytes', amount: 10 ** 12, entitlements: unlimited })
    ).resolves.toBeUndefined();
  });

  it('rejects when the amount would overrun, reporting current usage', async () => {
    await setUsage('user@example.com', 'storageBytes', 400);

    await expect(
      checkQuota({ subjectId: 'user@example.com', meter: 'storageBytes', amount: 601, entitlements: entitlements() })
    ).rejects.toMatchObject({ statusCode: 402, details: { meter: 'storageBytes', used: 400, limit: 1000 } });
  });
});

describe('releaseQuota', () => {
  it('hands capacity back after a failure', async () => {
    await consumeQuota({ subjectId: 'user@example.com', meter: 'aiJobs', amount: 3, entitlements: entitlements() });

    await releaseQuota('user@example.com', 'aiJobs', 3);

    expect(await getUsage('user@example.com', 'aiJobs')).toBe(0);
  });

  it('clamps at zero rather than going negative', async () => {
    await setUsage('user@example.com', 'storageBytes', 100);

    await releaseQuota('user@example.com', 'storageBytes', 500);

    expect(await getUsage('user@example.com', 'storageBytes')).toBe(0);
  });

  it('does not lose concurrent releases', async () => {
    await setUsage('user@example.com', 'storageBytes', 100);

    await Promise.all(Array.from({ length: 10 }, () => releaseQuota('user@example.com', 'storageBytes', 10)));

    expect(await getUsage('user@example.com', 'storageBytes')).toBe(0);
  });

  it('is a no-op when no counter exists', async () => {
    await expect(releaseQuota('nobody@example.com', 'seats', 1)).resolves.toBeUndefined();
    expect(await getUsage('nobody@example.com', 'seats')).toBe(0);
  });
});

describe('getUsageSnapshot', () => {
  it('reports every meter, defaulting the untouched ones to zero', async () => {
    await setUsage('user@example.com', 'storageBytes', 42);
    await setUsage('user@example.com', 'aiJobs', 7);
    await setUsage('other@example.com', 'seats', 99);

    expect(await getUsageSnapshot('user@example.com')).toEqual({
      storageBytes: 42,
      aiJobs: 7,
      trackedTickers: 0,
      seats: 0
    });
  });
});

describe('setUsage', () => {
  it('overwrites for backfill and reconciliation, refusing negatives', async () => {
    await setUsage('user@example.com', 'storageBytes', 5_000);
    expect(await getUsage('user@example.com', 'storageBytes')).toBe(5_000);

    await setUsage('user@example.com', 'storageBytes', -20);
    expect(await getUsage('user@example.com', 'storageBytes')).toBe(0);
  });
});
