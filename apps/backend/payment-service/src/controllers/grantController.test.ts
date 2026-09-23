import { Request, Response } from 'express';

const saveMock = jest.fn();
const subscriptionConstructor = jest.fn();

jest.mock('../models/Subscription', () => {
  class MockSubscription {
    userEmail?: string;
    isComp?: boolean;
    planCode?: string;
    plan?: unknown;
    status?: string;
    grantedBy?: string;
    grantReason?: string;
    expiresAt?: Date;
    canceledAt?: Date;
    cancelAt?: Date;
    save = saveMock;

    constructor(fields: Record<string, unknown>) {
      Object.assign(this, fields);
      subscriptionConstructor(fields);
    }

    static find = jest.fn();
    static findOne = jest.fn();
  }
  return { Subscription: MockSubscription };
});
jest.mock('../models/Plan', () => ({ Plan: { findOne: jest.fn() } }));

import { Subscription } from '../models/Subscription';
import { Plan } from '../models/Plan';
import { listGrants, grantSubscription, revokeGrant } from './grantController';

const mockedSubscription = Subscription as unknown as {
  find: jest.Mock;
  findOne: jest.Mock;
};
const mockedPlan = Plan as jest.Mocked<typeof Plan>;

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

function adminReq(overrides: Record<string, unknown> = {}): Request {
  return { user: { email: 'admin@example.com' }, body: {}, params: {}, ...overrides } as unknown as Request;
}

const staffPlan = { _id: 'plan-id', code: 'staff' };

beforeEach(() => {
  jest.clearAllMocks();
  saveMock.mockResolvedValue(undefined);
  mockedPlan.findOne.mockResolvedValue(staffPlan as never);
  mockedSubscription.findOne.mockResolvedValue(null);
});

describe('listGrants', () => {
  it('lists comp subscriptions newest first', async () => {
    const populate = jest.fn().mockResolvedValue([{ userEmail: 'a@b.com' }]);
    mockedSubscription.find.mockReturnValue({ sort: jest.fn().mockReturnValue({ populate }) });
    const res = mockRes();

    await listGrants(adminReq(), res);

    expect(mockedSubscription.find).toHaveBeenCalledWith({ isComp: true });
    expect(res.json).toHaveBeenCalledWith({ success: true, grants: [{ userEmail: 'a@b.com' }] });
  });
});

describe('grantSubscription', () => {
  it('creates a comp subscription with no Stripe involvement', async () => {
    const res = mockRes();

    await grantSubscription(
      adminReq({ body: { email: ' New@Example.COM ', planCode: 'staff', reason: 'maintainer' } }),
      res
    );

    expect(subscriptionConstructor).toHaveBeenCalledWith({ userEmail: 'new@example.com', isComp: true });
    const [{ grant }] = (res.json as jest.Mock).mock.calls[0];
    expect(grant).toMatchObject({
      planCode: 'staff',
      plan: 'plan-id',
      status: 'active',
      isComp: true,
      grantedBy: 'admin@example.com',
      grantReason: 'maintainer'
    });
    expect(grant.stripeSubscriptionId).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('moves an existing grant rather than stacking a second one', async () => {
    const existing = {
      userEmail: 'user@example.com',
      isComp: true,
      planCode: 'family',
      status: 'canceled',
      canceledAt: new Date('2026-01-01'),
      save: saveMock
    };
    mockedSubscription.findOne.mockResolvedValue(existing);
    const res = mockRes();

    await grantSubscription(adminReq({ body: { email: 'user@example.com', planCode: 'staff' } }), res);

    expect(subscriptionConstructor).not.toHaveBeenCalled();
    expect(existing.planCode).toBe('staff');
    expect(existing.status).toBe('active');
    // A re-grant after a revoke is a fresh grant, not a resurrected cancellation.
    expect(existing.canceledAt).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('records an expiry when one is given', async () => {
    const res = mockRes();

    await grantSubscription(
      adminReq({ body: { email: 'user@example.com', planCode: 'staff', expiresAt: '2026-12-31T00:00:00.000Z' } }),
      res
    );

    const [{ grant }] = (res.json as jest.Mock).mock.calls[0];
    expect(grant.expiresAt).toEqual(new Date('2026-12-31T00:00:00.000Z'));
  });

  it('rejects an unparseable expiry instead of storing an Invalid Date', async () => {
    await expect(
      grantSubscription(adminReq({ body: { email: 'u@e.com', planCode: 'staff', expiresAt: 'next tuesday' } }), mockRes())
    ).rejects.toMatchObject({ name: 'BadRequestError' });
  });

  it('refuses to grant a plan that does not exist', async () => {
    mockedPlan.findOne.mockResolvedValue(null);

    await expect(
      grantSubscription(adminReq({ body: { email: 'u@e.com', planCode: 'ghost' } }), mockRes())
    ).rejects.toMatchObject({ name: 'NotFoundError' });
  });
});

describe('revokeGrant', () => {
  it('cancels outright — there is no paid period to preserve', async () => {
    const grant = { userEmail: 'user@example.com', planCode: 'staff', status: 'active', save: saveMock };
    mockedSubscription.findOne.mockResolvedValue(grant);
    const res = mockRes();

    await revokeGrant(adminReq({ params: { email: 'User@Example.com' } }), res);

    expect(mockedSubscription.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ userEmail: 'user@example.com', isComp: true })
    );
    expect(grant.status).toBe('canceled');
    expect((grant as { canceledAt?: Date }).canceledAt).toBeInstanceOf(Date);
    expect(res.json).toHaveBeenCalledWith({ success: true, grant });
  });

  it('404s when the user has no active grant', async () => {
    await expect(revokeGrant(adminReq({ params: { email: 'nobody@example.com' } }), mockRes())).rejects.toMatchObject({
      name: 'NotFoundError'
    });
  });
});
