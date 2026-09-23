import { Request, Response } from 'express';

jest.mock('../models/EntitlementOverride', () => ({
  EntitlementOverride: {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndReplace: jest.fn(),
    findOneAndDelete: jest.fn()
  }
}));
jest.mock('../services/entitlementService', () => ({ resolveEntitlements: jest.fn() }));

import { normalizeLimits } from '@tumbaland/backend-core';
import { EntitlementOverride } from '../models/EntitlementOverride';
import { resolveEntitlements } from '../services/entitlementService';
import { listOverrides, getOverride, upsertOverride, deleteOverride } from './overrideController';

const mocked = EntitlementOverride as jest.Mocked<typeof EntitlementOverride>;
const mockedResolve = resolveEntitlements as jest.MockedFunction<typeof resolveEntitlements>;

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

function adminReq(overrides: Record<string, unknown> = {}): Request {
  return { user: { email: 'admin@example.com' }, body: {}, params: {}, ...overrides } as unknown as Request;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedResolve.mockResolvedValue({
    email: 'user@example.com',
    planCode: 'free',
    status: null,
    limits: normalizeLimits({ meters: { storageBytes: 5000 } }, 'free')
  });
});

describe('listOverrides', () => {
  it('lists every override newest first', async () => {
    mocked.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([{ userEmail: 'a@b.com' }]) } as never);
    const res = mockRes();

    await listOverrides(adminReq(), res);

    expect(res.json).toHaveBeenCalledWith({ success: true, overrides: [{ userEmail: 'a@b.com' }] });
  });
});

describe('getOverride', () => {
  it('returns the override with the limits it actually produces', async () => {
    mocked.findOne.mockResolvedValue({ userEmail: 'user@example.com', reason: 'friend' } as never);
    const res = mockRes();

    await getOverride(adminReq({ params: { email: 'User@Example.com' } }), res);

    expect(mocked.findOne).toHaveBeenCalledWith({ userEmail: 'user@example.com' });
    const [body] = (res.json as jest.Mock).mock.calls[0];
    expect(body.effectiveLimits.meters.storageBytes).toBe(5000);
    expect(body.planCode).toBe('free');
  });

  it('404s when the user has no override', async () => {
    mocked.findOne.mockResolvedValue(null as never);

    await expect(getOverride(adminReq({ params: { email: 'nobody@example.com' } }), mockRes())).rejects.toMatchObject({
      name: 'NotFoundError'
    });
  });
});

describe('upsertOverride', () => {
  it('replaces the stored override, so an adjustment can be removed', async () => {
    mocked.findOneAndReplace.mockResolvedValue({ userEmail: 'user@example.com' } as never);
    const res = mockRes();

    await upsertOverride(
      adminReq({
        params: { email: 'User@Example.com' },
        body: { meters: { storageBytes: 5000 }, reason: 'friend of the house' }
      }),
      res
    );

    expect(mocked.findOneAndReplace).toHaveBeenCalledWith(
      { userEmail: 'user@example.com' },
      expect.objectContaining({
        userEmail: 'user@example.com',
        meters: { storageBytes: 5000 },
        reason: 'friend of the house',
        grantedBy: 'admin@example.com'
      }),
      expect.objectContaining({ upsert: true })
    );
    const [body] = (res.json as jest.Mock).mock.calls[0];
    expect(body.effectiveLimits.meters.storageBytes).toBe(5000);
  });

  it('stores an expiry, so a temporary bump does not quietly become permanent', async () => {
    mocked.findOneAndReplace.mockResolvedValue({} as never);

    await upsertOverride(
      adminReq({
        params: { email: 'user@example.com' },
        body: { meters: { storageBytes: 1 }, reason: 'migration', expiresAt: '2026-09-01T00:00:00.000Z' }
      }),
      mockRes()
    );

    expect(mocked.findOneAndReplace).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ expiresAt: new Date('2026-09-01T00:00:00.000Z') }),
      expect.anything()
    );
  });

  it('rejects an unparseable expiry', async () => {
    await expect(
      upsertOverride(
        adminReq({ params: { email: 'u@e.com' }, body: { reason: 'x', expiresAt: 'soon' } }),
        mockRes()
      )
    ).rejects.toMatchObject({ name: 'BadRequestError' });
    expect(mocked.findOneAndReplace).not.toHaveBeenCalled();
  });
});

describe('deleteOverride', () => {
  it('removes the override and reports what the user is left with', async () => {
    mocked.findOneAndDelete.mockResolvedValue({ userEmail: 'user@example.com' } as never);
    mockedResolve.mockResolvedValue({
      email: 'user@example.com',
      planCode: 'free',
      status: null,
      limits: normalizeLimits(undefined, 'free')
    });
    const res = mockRes();

    await deleteOverride(adminReq({ params: { email: 'user@example.com' } }), res);

    const [body] = (res.json as jest.Mock).mock.calls[0];
    expect(body.effectiveLimits.meters.storageBytes).toBe(1024 * 1024 * 1024);
  });

  it('404s when there was nothing to remove', async () => {
    mocked.findOneAndDelete.mockResolvedValue(null as never);

    await expect(
      deleteOverride(adminReq({ params: { email: 'nobody@example.com' } }), mockRes())
    ).rejects.toMatchObject({ name: 'NotFoundError' });
  });
});
