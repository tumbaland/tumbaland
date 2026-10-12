import { Request, Response } from 'express';

jest.mock('../services/plan.service', () => ({
  listPlans: jest.fn(),
  createPlan: jest.fn(),
  updatePlan: jest.fn(),
  deletePlan: jest.fn(),
  logPlan: jest.fn()
}));

import * as PlanService from '../services/plan.service';
import { createPlan, deletePlan, getPlans, logPlan, updatePlan } from './plan.controller';

function mockRes(): Response {
  const res: Partial<Response> = { locals: {} };
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  return res as Response;
}

const req = (over: Record<string, unknown>) =>
  ({ user: { id: 'u1' }, userGroups: ['g1'], query: {}, params: {}, body: {}, ...over }) as unknown as Request;

beforeEach(() => jest.clearAllMocks());

describe('getPlans', () => {
  it('reads a month of plans', async () => {
    (PlanService.listPlans as jest.Mock).mockResolvedValue([{ id: 'p1' }]);
    const res = mockRes();
    await getPlans(req({ query: { groupId: 'g1', startDate: '2026-10-01', endDate: '2026-10-31' } }), res);
    expect(PlanService.listPlans).toHaveBeenCalledWith({
      userId: 'u1',
      userGroupIds: ['g1'],
      groupId: 'g1',
      startDate: new Date('2026-10-01T00:00:00.000Z'),
      endDate: new Date('2026-10-31T00:00:00.000Z'),
      upcoming: false,
      limit: 100
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: [{ id: 'p1' }] }));
  });

  it('reads the upcoming ones from a day on', async () => {
    (PlanService.listPlans as jest.Mock).mockResolvedValue([]);
    await getPlans(req({ query: { upcoming: 'true', startDate: '2026-10-12', limit: '3' } }), mockRes());
    expect(PlanService.listPlans).toHaveBeenCalledWith(expect.objectContaining({ upcoming: true, limit: 3 }));
  });

  it('refuses a malformed day', async () => {
    await expect(getPlans(req({ query: { startDate: 'friday' } }), mockRes())).rejects.toThrow(
      'Date must be formatted as YYYY-MM-DD'
    );
  });
});

it('creates a plan', async () => {
  (PlanService.createPlan as jest.Mock).mockResolvedValue({ id: 'p1' });
  const res = mockRes();
  await createPlan(req({ body: { title: 'Concert' } }), res);
  expect(PlanService.createPlan).toHaveBeenCalledWith({ title: 'Concert' }, 'u1', ['g1']);
  expect(res.status).toHaveBeenCalledWith(201);
});

it('updates a plan', async () => {
  (PlanService.updatePlan as jest.Mock).mockResolvedValue({ id: 'p1' });
  await updatePlan(req({ params: { id: 'p1' }, body: { title: 'Gig' } }), mockRes());
  expect(PlanService.updatePlan).toHaveBeenCalledWith('p1', { title: 'Gig' }, 'u1', ['g1']);
});

it('deletes a plan', async () => {
  const res = mockRes();
  await deletePlan(req({ params: { id: 'p1' } }), res);
  expect(PlanService.deletePlan).toHaveBeenCalledWith('p1', 'u1', ['g1']);
  expect(res.status).toHaveBeenCalledWith(200);
});

it('logs a plan as an entry', async () => {
  (PlanService.logPlan as jest.Mock).mockResolvedValue({ plan: { id: 'p1' }, activityId: 'a1' });
  await logPlan(req({ params: { id: 'p1' }, body: { typeId: 't1' } }), mockRes());
  expect(PlanService.logPlan).toHaveBeenCalledWith('p1', 't1', 'u1', ['g1']);
});
