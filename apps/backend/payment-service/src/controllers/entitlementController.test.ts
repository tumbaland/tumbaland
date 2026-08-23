import { Request, Response } from 'express';

jest.mock('../services/entitlementService', () => ({ resolveEntitlements: jest.fn() }));
jest.mock('@tumbaland/backend-core', () => {
  const actual = jest.requireActual('@tumbaland/backend-core');
  return { ...actual, getUsageSnapshot: jest.fn() };
});

import { getUsageSnapshot, normalizeLimits } from '@tumbaland/backend-core';
import { resolveEntitlements } from '../services/entitlementService';
import { getEntitlementsByEmail, getMyEntitlements } from './entitlementController';

const mockedResolve = resolveEntitlements as jest.MockedFunction<typeof resolveEntitlements>;
const mockedSnapshot = getUsageSnapshot as jest.MockedFunction<typeof getUsageSnapshot>;

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

const resolved = {
  email: 'user@example.com',
  planCode: 'free',
  status: 'active',
  limits: normalizeLimits(undefined, 'free'),
  upgradeTo: 'support'
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedResolve.mockResolvedValue(resolved);
  mockedSnapshot.mockResolvedValue({ storageBytes: 10, aiJobs: 2, trackedTickers: 1, seats: 1 });
});

describe('getEntitlementsByEmail', () => {
  it('answers with the plan, status and resolved limits', async () => {
    const res = mockRes();

    await getEntitlementsByEmail({ query: { email: 'user@example.com' } } as unknown as Request, res);

    expect(mockedResolve).toHaveBeenCalledWith('user@example.com');
    expect(res.json).toHaveBeenCalledWith({ success: true, ...resolved });
  });

  it('rejects a call with no email rather than answering for nobody', async () => {
    await expect(getEntitlementsByEmail({ query: {} } as unknown as Request, mockRes())).rejects.toMatchObject({
      name: 'BadRequestError'
    });
    await expect(
      getEntitlementsByEmail({ query: { email: '   ' } } as unknown as Request, mockRes())
    ).rejects.toMatchObject({ name: 'BadRequestError' });
    expect(mockedResolve).not.toHaveBeenCalled();
  });
});

describe('getMyEntitlements', () => {
  it('returns the caller\'s own limits alongside live meter readings', async () => {
    const res = mockRes();

    await getMyEntitlements({ user: { email: 'user@example.com' } } as unknown as Request, res);

    expect(mockedResolve).toHaveBeenCalledWith('user@example.com');
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      ...resolved,
      usage: { storageBytes: 10, aiJobs: 2, trackedTickers: 1, seats: 1 }
    });
  });
});
