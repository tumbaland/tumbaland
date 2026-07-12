import { Request, Response } from 'express';

jest.mock('../models/Plan', () => ({
  Plan: {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    insertMany: jest.fn()
  }
}));

import { Plan } from '../models/Plan';
import { listPlans, createPlan, createPlansBulk, updatePlanStripePrices } from './planController';

const mocked = Plan as jest.Mocked<typeof Plan>;

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

beforeEach(() => jest.clearAllMocks());

describe('listPlans', () => {
  it('lists active plans sorted by price', async () => {
    mocked.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([{ code: 'free' }]) } as any);
    const res = mockRes();

    await listPlans({} as Request, res);

    expect(mocked.find).toHaveBeenCalledWith({ isActive: true });
    expect(res.json).toHaveBeenCalledWith({ success: true, plans: [{ code: 'free' }] });
  });
});

describe('createPlan', () => {
  it('creates a single plan', async () => {
    mocked.findOne.mockResolvedValue(null);
    mocked.create.mockResolvedValue({ code: 'pro' } as any);
    const res = mockRes();

    await createPlan({ body: { name: 'Pro', code: 'pro' } } as Request, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, plan: { code: 'pro' } });
  });

  it('throws ConflictError when the code already exists', async () => {
    mocked.findOne.mockResolvedValue({ code: 'pro' } as any);
    const res = mockRes();

    await expect(createPlan({ body: { code: 'pro' } } as Request, res)).rejects.toMatchObject({
      name: 'ConflictError'
    });
  });

  it('creates multiple plans when the body is an array', async () => {
    mocked.findOne.mockResolvedValue(null);
    mocked.create.mockResolvedValueOnce({ code: 'a' } as any).mockResolvedValueOnce({ code: 'b' } as any);
    const res = mockRes();

    await createPlan({ body: [{ code: 'a' }, { code: 'b' }] } as unknown as Request, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, plans: [{ code: 'a' }, { code: 'b' }] });
  });

  it('throws ConflictError for an array entry whose code already exists', async () => {
    mocked.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ code: 'b' } as any);
    mocked.create.mockResolvedValueOnce({ code: 'a' } as any);
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
    mocked.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([{ code: 'a' }]) } as any);
    const res = mockRes();

    await expect(createPlansBulk({ body: [{ code: 'a' }] } as unknown as Request, res)).rejects.toMatchObject({
      name: 'ConflictError'
    });
  });

  it('inserts all plans when there are no conflicts', async () => {
    mocked.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) } as any);
    mocked.insertMany.mockResolvedValue([{ code: 'a' }, { code: 'b' }] as any);
    const res = mockRes();

    await createPlansBulk({ body: [{ code: 'a' }, { code: 'b' }] } as unknown as Request, res);

    expect(res.status).toHaveBeenCalledWith(201);
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
    const plan: any = { code: 'pro', save: jest.fn().mockResolvedValue(undefined) };
    mocked.findOne.mockResolvedValue(plan);
    const res = mockRes();

    await updatePlanStripePrices(
      { params: { code: 'pro' }, body: { stripePriceId: 'price_123' } } as unknown as Request,
      res
    );

    expect(plan.stripePriceId).toBe('price_123');
    expect(plan.save).toHaveBeenCalledTimes(1);
  });
});
