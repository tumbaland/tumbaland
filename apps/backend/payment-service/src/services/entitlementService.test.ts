jest.mock('../models/Subscription', () => ({ Subscription: { find: jest.fn() } }));
jest.mock('../models/Plan', () => ({ Plan: { findOne: jest.fn() } }));
jest.mock('../models/EntitlementOverride', () => ({ EntitlementOverride: { findOne: jest.fn() } }));

import { DEFAULT_PLAN_LIMITS, UNLIMITED } from '@tumbaland/backend-core';
import { Subscription } from '../models/Subscription';
import { Plan } from '../models/Plan';
import { EntitlementOverride } from '../models/EntitlementOverride';
import { ENTITLED_STATUSES, notExpired, resolveEntitlements } from './entitlementService';

const mockedSubscription = Subscription as jest.Mocked<typeof Subscription>;
const mockedPlan = Plan as jest.Mocked<typeof Plan>;
const mockedOverride = EntitlementOverride as jest.Mocked<typeof EntitlementOverride>;

/** `Subscription.find(...).populate(...)` */
function mockSubscriptions(subs: unknown[]): void {
  mockedSubscription.find.mockReturnValue({ populate: jest.fn().mockResolvedValue(subs) } as never);
}

function sub(overrides: Record<string, unknown> = {}) {
  return {
    status: 'active',
    planCode: 'personal',
    createdAt: new Date('2026-01-01'),
    plan: { code: 'personal', priceMonthlyCents: 600, limits: undefined },
    ...overrides
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: no upgrade target found.
  mockedPlan.findOne.mockReturnValue({
    sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) })
  } as never);
  mockedOverride.findOne.mockResolvedValue(null as never);
});

describe('resolveEntitlements', () => {
  it('queries only the statuses that still grant access', async () => {
    mockSubscriptions([]);

    await resolveEntitlements('user@example.com');

    expect(mockedSubscription.find).toHaveBeenCalledWith(
      expect.objectContaining({ userEmail: 'user@example.com', status: { $in: ENTITLED_STATUSES } })
    );
    expect(ENTITLED_STATUSES).toEqual(['active', 'past_due', 'canceling']);
  });

  it('lowercases and trims the email before looking anything up', async () => {
    mockSubscriptions([]);

    const result = await resolveEntitlements('  User@Example.COM ');

    expect(result.email).toBe('user@example.com');
    expect(mockedSubscription.find).toHaveBeenCalledWith(expect.objectContaining({ userEmail: 'user@example.com' }));
  });

  it('falls back to the free plan document for a user with no subscription', async () => {
    mockSubscriptions([]);
    mockedPlan.findOne.mockResolvedValueOnce({ code: 'free', priceMonthlyCents: 0, limits: { meters: { seats: 2 } } } as never);

    const result = await resolveEntitlements('user@example.com');

    expect(result.planCode).toBe('free');
    expect(result.status).toBeNull();
    // Free is admin-configurable like any other plan, so its document is read too.
    expect(result.limits.meters.seats).toBe(2);
  });

  it('reads the limits off the plan document rather than a hardcoded table', async () => {
    mockSubscriptions([sub({ plan: { code: 'support', priceMonthlyCents: 600, limits: { meters: { storageBytes: 77 }, retentionDays: UNLIMITED } } })]);

    const result = await resolveEntitlements('user@example.com');

    expect(result.planCode).toBe('support');
    expect(result.status).toBe('active');
    expect(result.limits.meters.storageBytes).toBe(77);
    expect(result.limits.meters.aiJobs).toBe(DEFAULT_PLAN_LIMITS.support.meters.aiJobs);
  });

  it('treats canceling as entitled — the user paid for the period still running', async () => {
    mockSubscriptions([sub({ status: 'canceling' })]);

    const result = await resolveEntitlements('user@example.com');

    expect(result.planCode).toBe('personal');
    expect(result.status).toBe('canceling');
  });

  it('treats past_due as entitled, leaving the grace period to dunning', async () => {
    mockSubscriptions([sub({ status: 'past_due' })]);

    expect((await resolveEntitlements('user@example.com')).planCode).toBe('personal');
  });

  it('picks the highest-priced subscription when a user holds several', async () => {
    mockSubscriptions([
      sub({ planCode: 'personal', plan: { code: 'personal', priceMonthlyCents: 600 } }),
      sub({ planCode: 'family', plan: { code: 'family', priceMonthlyCents: 1200 } })
    ]);

    expect((await resolveEntitlements('user@example.com')).planCode).toBe('family');
  });

  it('breaks a price tie on status, then on recency', async () => {
    mockSubscriptions([
      sub({ status: 'past_due', createdAt: new Date('2026-06-01') }),
      sub({ status: 'active', createdAt: new Date('2026-01-01') })
    ]);

    expect((await resolveEntitlements('user@example.com')).status).toBe('active');

    mockSubscriptions([
      sub({ createdAt: new Date('2026-01-01'), plan: { code: 'older', priceMonthlyCents: 600 } }),
      sub({ createdAt: new Date('2026-06-01'), plan: { code: 'newer', priceMonthlyCents: 600 } })
    ]);
    expect((await resolveEntitlements('user@example.com')).planCode).toBe('newer');
  });

  it('resolves to free, not to unlimited, when the plan was deleted under a live subscription', async () => {
    mockSubscriptions([sub({ planCode: 'ghost-plan', plan: undefined })]);
    mockedPlan.findOne.mockResolvedValueOnce(null as never);

    const result = await resolveEntitlements('user@example.com');

    expect(result.planCode).toBe('ghost-plan');
    expect(result.limits).toEqual(DEFAULT_PLAN_LIMITS.free);
  });

  it('names the cheapest plan above the current price as the upgrade target', async () => {
    mockSubscriptions([]);
    mockedPlan.findOne
      .mockResolvedValueOnce({ code: 'free', priceMonthlyCents: 0 } as never)
      .mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ code: 'personal' }) })
      } as never);

    expect((await resolveEntitlements('user@example.com')).upgradeTo).toBe('personal');
  });

  it('leaves the upgrade target unset on the top plan', async () => {
    mockSubscriptions([sub({ planCode: 'family', plan: { code: 'family', priceMonthlyCents: 1200 } })]);

    expect((await resolveEntitlements('user@example.com')).upgradeTo).toBeUndefined();
  });

  it('excludes expired grants and overrides from the lookup', async () => {
    mockSubscriptions([]);

    await resolveEntitlements('user@example.com');

    const filter = mockedSubscription.find.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(filter.$or).toEqual([
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: expect.any(Date) } }
    ]);
    expect(mockedOverride.findOne).toHaveBeenCalledWith(expect.objectContaining({ $or: expect.any(Array) }));
  });
});

describe('comp grants', () => {
  it('outranks a paid subscription, because price is only a proxy for generosity', async () => {
    // The staff plan is priced at zero. Ranking by price alone would let any
    // paid plan the same account holds beat an explicit admin grant.
    mockSubscriptions([
      sub({ planCode: 'family', plan: { code: 'family', priceMonthlyCents: 1200 } }),
      sub({ planCode: 'staff', isComp: true, plan: { code: 'staff', priceMonthlyCents: 0 } })
    ]);

    const result = await resolveEntitlements('user@example.com');

    expect(result.planCode).toBe('staff');
    expect(result.isComp).toBe(true);
  });

  it('offers no upgrade to a comped account', async () => {
    mockSubscriptions([sub({ planCode: 'staff', isComp: true, plan: { code: 'staff', priceMonthlyCents: 0 } })]);
    mockedPlan.findOne.mockReturnValue({
      sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ code: 'personal' }) })
    } as never);

    expect((await resolveEntitlements('user@example.com')).upgradeTo).toBeUndefined();
  });

  it('reports isComp false for an ordinary paying user', async () => {
    mockSubscriptions([sub()]);

    expect((await resolveEntitlements('user@example.com')).isComp).toBe(false);
  });
});

describe('per-user overrides', () => {
  it('layers on top of the plan, leaving untouched meters alone', async () => {
    mockSubscriptions([sub({ plan: { code: 'support', priceMonthlyCents: 600, limits: { meters: { storageBytes: 100 } } } })]);
    mockedOverride.findOne.mockResolvedValue({ meters: { storageBytes: 5000 }, reason: 'friend' } as never);

    const result = await resolveEntitlements('user@example.com');

    expect(result.limits.meters.storageBytes).toBe(5000);
    expect(result.limits.meters.aiJobs).toBe(DEFAULT_PLAN_LIMITS.support.meters.aiJobs);
    expect(result.hasOverride).toBe(true);
  });

  it('can grant a feature or unlimited retention to one user without touching the plan', async () => {
    mockSubscriptions([]);
    mockedPlan.findOne.mockResolvedValueOnce({ code: 'free', priceMonthlyCents: 0 } as never);
    mockedOverride.findOne.mockResolvedValue({
      features: { cleanExport: true },
      retentionDays: UNLIMITED,
      reason: 'beta tester'
    } as never);

    const result = await resolveEntitlements('user@example.com');

    expect(result.planCode).toBe('free');
    expect(result.limits.features.cleanExport).toBe(true);
    expect(result.limits.retentionDays).toBe(UNLIMITED);
  });

  it('reports hasOverride false when there is none', async () => {
    mockSubscriptions([]);

    expect((await resolveEntitlements('user@example.com')).hasOverride).toBe(false);
  });
});

describe('notExpired', () => {
  it('matches documents with no expiry or one in the future', () => {
    const now = new Date('2026-08-09T00:00:00.000Z');

    expect(notExpired(now)).toEqual({
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }]
    });
  });
});
