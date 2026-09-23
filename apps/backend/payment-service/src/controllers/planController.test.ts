import { Request, Response } from 'express';

jest.mock('../models/Plan', () => ({
  Plan: {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    insertMany: jest.fn()
  }
}));
jest.mock('../models/Subscription', () => ({ Subscription: { find: jest.fn() } }));

import { DEFAULT_PLAN_LIMITS, UNLIMITED } from '@tumbaland/backend-core';
import { IPlan, Plan } from '../models/Plan';
import { Subscription } from '../models/Subscription';
import {
  listPlans,
  listAllPlans,
  createPlan,
  createPlansBulk,
  updatePlan,
  updatePlanLimits,
  updatePlanStripePrices,
  getEntitlementCatalog
} from './planController';

/** The fields of a Plan document the handler reads and writes. */
type FakePlan = Partial<Omit<IPlan, 'save'>> & { save: jest.Mock };

const mocked = Plan as jest.Mocked<typeof Plan>;
const mockedSubscription = Subscription as jest.Mocked<typeof Subscription>;

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

/** `Plan.find(...).sort(...)` for the catalog query. */
function mockCatalog(plans: unknown[]): void {
  mocked.find.mockReturnValue({ sort: jest.fn().mockResolvedValue(plans) } as never);
}

/** `Subscription.find(...).distinct('planCode')` for the caller's own plans. */
function mockMyPlanCodes(codes: string[]): void {
  mockedSubscription.find.mockReturnValue({ distinct: jest.fn().mockResolvedValue(codes) } as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockMyPlanCodes([]);
});

describe('listPlans', () => {
  it('lists active, public plans sorted by price', async () => {
    mockCatalog([{ code: 'free' }]);
    const res = mockRes();

    await listPlans({} as Request, res);

    expect(mocked.find).toHaveBeenCalledWith({ isActive: true, isPublic: { $ne: false } });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      plans: [expect.objectContaining({ code: 'free' })]
    });
  });

  it('appends the caller\'s own hidden plan after the catalog, so a staff account does not read as free', async () => {
    mocked.find.mockReturnValueOnce({
      sort: jest.fn().mockResolvedValue([{ code: 'free', priceMonthlyCents: 0 }, { code: 'family', priceMonthlyCents: 1200 }])
    } as never);
    mockMyPlanCodes(['staff']);
    // A granted plan is priced at zero, so sorting it in would land it next to
    // Free, in the middle of a ladder it isn't part of. It goes last.
    mocked.find.mockReturnValueOnce({
      sort: jest.fn().mockResolvedValue([{ code: 'staff', priceMonthlyCents: 0, isPublic: false }])
    } as never);
    const res = mockRes();

    await listPlans({ user: { email: 'Staff@Example.com' } } as Request, res);

    expect(mockedSubscription.find).toHaveBeenCalledWith(expect.objectContaining({ userEmail: 'staff@example.com' }));
    const [{ plans }] = (res.json as jest.Mock).mock.calls[0];
    expect(plans.map((p: { code: string }) => p.code)).toEqual(['free', 'family', 'staff']);
  });

  it('does not re-fetch when the caller is on a plan already in the catalog', async () => {
    mockCatalog([{ code: 'free' }]);
    mockMyPlanCodes(['free']);
    const res = mockRes();

    await listPlans({ user: { email: 'user@example.com' } } as Request, res);

    expect(mocked.find).toHaveBeenCalledTimes(1);
    const [{ plans }] = (res.json as jest.Mock).mock.calls[0];
    expect(plans).toHaveLength(1);
  });

  it('shows an anonymous caller the public catalog only', async () => {
    mockCatalog([{ code: 'free' }]);

    await listPlans({} as Request, mockRes());

    expect(mockedSubscription.find).not.toHaveBeenCalled();
  });

  it('resolves the limits the pricing page renders, so a card cannot advertise a number nothing enforces', async () => {
    mocked.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([{ code: 'support', limits: { meters: { storageBytes: 999 } } }])
    } as never);
    const res = mockRes();

    await listPlans({} as Request, res);

    const [{ plans }] = (res.json as jest.Mock).mock.calls[0];
    expect(plans[0].effectiveLimits.meters.storageBytes).toBe(999);
    // Anything the document leaves unset resolves from that plan's defaults.
    expect(plans[0].effectiveLimits.meters.seats).toBe(DEFAULT_PLAN_LIMITS.support.meters.seats);
  });
});

describe('listAllPlans', () => {
  it('includes inactive plans, which are exactly the ones an admin is editing', async () => {
    mocked.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([{ code: 'retired', isActive: false }]) } as never);
    const res = mockRes();

    await listAllPlans({} as Request, res);

    expect(mocked.find).toHaveBeenCalledWith({});
    const [{ plans }] = (res.json as jest.Mock).mock.calls[0];
    expect(plans[0]).toMatchObject({ code: 'retired', isActive: false });
    expect(plans[0].effectiveLimits).toBeDefined();
  });
});

describe('getEntitlementCatalog', () => {
  it('returns the meter and feature vocabulary an admin form builds itself from', () => {
    const res = mockRes();

    getEntitlementCatalog({} as Request, res);

    const [{ catalog }] = (res.json as jest.Mock).mock.calls[0];
    expect(catalog.meters.map((m: { key: string }) => m.key)).toContain('storageBytes');
    expect(catalog.features.map((f: { key: string }) => f.key)).toContain('cleanExport');
    expect(catalog.unlimited).toBe(UNLIMITED);
  });
});

describe('createPlan', () => {
  it('creates a single plan', async () => {
    mocked.findOne.mockResolvedValue(null);
    mocked.create.mockResolvedValue({ code: 'pro' } as never);
    const res = mockRes();

    await createPlan({ body: { name: 'Pro', code: 'pro' } } as Request, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, plan: { code: 'pro' } });
  });

  it('throws ConflictError when the code already exists', async () => {
    mocked.findOne.mockResolvedValue({ code: 'pro' } as never);
    const res = mockRes();

    await expect(createPlan({ body: { code: 'pro' } } as Request, res)).rejects.toMatchObject({
      name: 'ConflictError'
    });
  });

  it('creates multiple plans when the body is an array', async () => {
    mocked.findOne.mockResolvedValue(null);
    mocked.create.mockResolvedValueOnce({ code: 'a' } as never).mockResolvedValueOnce({ code: 'b' } as never);
    const res = mockRes();

    await createPlan({ body: [{ code: 'a' }, { code: 'b' }] } as unknown as Request, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, plans: [{ code: 'a' }, { code: 'b' }] });
  });

  it('throws ConflictError for an array entry whose code already exists', async () => {
    mocked.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ code: 'b' } as never);
    mocked.create.mockResolvedValueOnce({ code: 'a' } as never);
    const res = mockRes();

    await expect(createPlan({ body: [{ code: 'a' }, { code: 'b' }] } as unknown as Request, res)).rejects.toMatchObject({
      name: 'ConflictError'
    });
  });
});

describe('createPlansBulk', () => {
  it('throws BadRequestError for a duplicate code within the payload', async () => {
    const res = mockRes();
    await expect(
      createPlansBulk({ body: [{ code: 'a' }, { code: 'a' }] } as unknown as Request, res)
    ).rejects.toMatchObject({ name: 'BadRequestError' });
  });

  it('throws ConflictError when a code already exists in the DB', async () => {
    mocked.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([{ code: 'a' }]) } as never);
    const res = mockRes();

    await expect(createPlansBulk({ body: [{ code: 'a' }] } as unknown as Request, res)).rejects.toMatchObject({
      name: 'ConflictError'
    });
  });

  it('inserts all plans when there are no conflicts', async () => {
    mocked.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) } as never);
    mocked.insertMany.mockResolvedValue([{ code: 'a' }, { code: 'b' }] as never);
    const res = mockRes();

    await createPlansBulk({ body: [{ code: 'a' }, { code: 'b' }] } as unknown as Request, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('updatePlan', () => {
  it('throws NotFoundError when the plan does not exist', async () => {
    mocked.findOne.mockResolvedValue(null);

    await expect(
      updatePlan({ params: { code: 'missing' }, body: { name: 'x' } } as unknown as Request, mockRes())
    ).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('applies only the fields present in the body', async () => {
    const plan: FakePlan = { code: 'personal', name: 'Personal', isActive: true, save: jest.fn() };
    mocked.findOne.mockResolvedValue(plan as never);

    await updatePlan(
      { params: { code: 'personal' }, body: { priceMonthlyCents: 700, isActive: false } } as unknown as Request,
      mockRes()
    );

    expect(plan.priceMonthlyCents).toBe(700);
    expect(plan.isActive).toBe(false);
    expect(plan.name).toBe('Personal');
    expect(plan.save).toHaveBeenCalledTimes(1);
  });

  it('merges limits rather than replacing them', async () => {
    const plan: FakePlan = {
      code: 'personal',
      limits: { meters: { storageBytes: 100, seats: 2 } },
      save: jest.fn()
    };
    mocked.findOne.mockResolvedValue(plan as never);

    await updatePlan(
      { params: { code: 'personal' }, body: { limits: { meters: { seats: 5 } } } } as unknown as Request,
      mockRes()
    );

    expect(plan.limits?.meters).toEqual({ storageBytes: 100, seats: 5 });
  });
});

describe('updatePlanLimits', () => {
  it('throws NotFoundError when the plan does not exist', async () => {
    mocked.findOne.mockResolvedValue(null);

    await expect(
      updatePlanLimits({ params: { code: 'missing' }, query: {}, body: {} } as unknown as Request, mockRes())
    ).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('merges a partial payload, so a form that only knows one meter cannot reset the rest', async () => {
    const plan: FakePlan = {
      code: 'family',
      limits: { meters: { storageBytes: 100, seats: 5 }, features: { cleanExport: true }, retentionDays: 400 },
      save: jest.fn()
    };
    mocked.findOne.mockResolvedValue(plan as never);
    const res = mockRes();

    await updatePlanLimits(
      { params: { code: 'family' }, query: {}, body: { meters: { storageBytes: 250 } } } as unknown as Request,
      res
    );

    expect(plan.limits).toEqual({
      meters: { storageBytes: 250, seats: 5 },
      features: { cleanExport: true },
      retentionDays: 400
    });
    expect(plan.save).toHaveBeenCalledTimes(1);
  });

  it('drops the stored limits first when asked to replace', async () => {
    const plan: FakePlan = { code: 'family', limits: { meters: { storageBytes: 100, seats: 5 } }, save: jest.fn() };
    mocked.findOne.mockResolvedValue(plan as never);

    await updatePlanLimits(
      { params: { code: 'family' }, query: { replace: 'true' }, body: { meters: { seats: 3 } } } as unknown as Request,
      mockRes()
    );

    expect(plan.limits?.meters).toEqual({ seats: 3 });
  });

  it('echoes the resolved numbers, including the ones defaults filled in', async () => {
    const plan: FakePlan = { code: 'support', save: jest.fn() };
    mocked.findOne.mockResolvedValue(plan as never);
    const res = mockRes();

    await updatePlanLimits(
      { params: { code: 'support' }, query: {}, body: { retentionDays: UNLIMITED } } as unknown as Request,
      res
    );

    const [{ effectiveLimits }] = (res.json as jest.Mock).mock.calls[0];
    expect(effectiveLimits.retentionDays).toBe(UNLIMITED);
    expect(effectiveLimits.meters.seats).toBe(DEFAULT_PLAN_LIMITS.support.meters.seats);
  });
});

describe('updatePlanStripePrices', () => {
  it('throws NotFoundError when the plan does not exist', async () => {
    mocked.findOne.mockResolvedValue(null);
    const res = mockRes();

    await expect(
      updatePlanStripePrices({ params: { code: 'missing' }, body: {} } as unknown as Request, res)
    ).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('updates the stripePriceId and saves', async () => {
    const plan: FakePlan = { code: 'pro', save: jest.fn().mockResolvedValue(undefined) };
    mocked.findOne.mockResolvedValue(plan as never);
    const res = mockRes();

    await updatePlanStripePrices(
      { params: { code: 'pro' }, body: { stripePriceId: 'price_123' } } as unknown as Request,
      res
    );

    expect(plan.stripePriceId).toBe('price_123');
    expect(plan.save).toHaveBeenCalledTimes(1);
  });
});
