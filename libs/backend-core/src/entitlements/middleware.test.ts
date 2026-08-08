import { Request, Response } from 'express';

jest.mock('../logging/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), http: jest.fn() }
}));
jest.mock('./client', () => ({ getEntitlements: jest.fn() }));
jest.mock('./usage', () => ({ checkQuota: jest.fn() }));

import logger from '../logging/logger';
import { getEntitlements } from './client';
import { checkQuota } from './usage';
import { loadEntitlements, requireEntitlement, requireQuota, retentionFloor } from './middleware';
import { Entitlements } from './types';
import { UNLIMITED, normalizeLimits } from './definitions';

const mockGetEntitlements = getEntitlements as jest.MockedFunction<typeof getEntitlements>;
const mockCheckQuota = checkQuota as jest.MockedFunction<typeof checkQuota>;

const ORIGINAL_ENV = process.env;

function entitlements(overrides: Partial<Entitlements> = {}): Entitlements {
  return {
    email: 'user@example.com',
    planCode: 'free',
    status: null,
    limits: normalizeLimits(undefined, 'free'),
    upgradeTo: 'personal',
    ...overrides
  };
}

function mockReq(overrides: Partial<Request> = {}): Request {
  return { user: { email: 'user@example.com' }, originalUrl: '/api/photos', ...overrides } as Request;
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, ENTITLEMENTS_MODE: 'enforce' };
  jest.clearAllMocks();
  mockGetEntitlements.mockResolvedValue(entitlements());
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('loadEntitlements', () => {
  it('resolves once per request even across several checks', async () => {
    const req = mockReq();

    await loadEntitlements(req);
    await loadEntitlements(req);

    expect(mockGetEntitlements).toHaveBeenCalledTimes(1);
    expect(req.entitlements?.planCode).toBe('free');
  });

  it('rejects when there is no subject to bill', async () => {
    await expect(loadEntitlements(mockReq({ user: undefined }))).rejects.toMatchObject({ statusCode: 401 });
  });

  it('bills the subject a resolver names, not the caller', async () => {
    await loadEntitlements(mockReq(), () => 'owner@example.com');

    expect(mockGetEntitlements).toHaveBeenCalledWith('owner@example.com');
  });
});

describe('requireEntitlement', () => {
  it('passes a plan that includes the feature', async () => {
    mockGetEntitlements.mockResolvedValue(entitlements({ planCode: 'personal', limits: normalizeLimits(undefined, 'personal') }));
    const next = jest.fn();

    await requireEntitlement('cleanExport')(mockReq(), {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('rejects with a 402 naming the feature and the upgrade target', async () => {
    const next = jest.fn();

    await requireEntitlement('cleanExport')(mockReq(), {} as Response, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 402,
        details: { code: 'FEATURE_NOT_IN_PLAN', feature: 'cleanExport', planCode: 'free', upgradeTo: 'personal' }
      })
    );
  });

  it('logs instead of blocking in observe mode', async () => {
    process.env.ENTITLEMENTS_MODE = 'observe';
    const next = jest.fn();

    await requireEntitlement('cleanExport')(mockReq(), {} as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(logger.info).toHaveBeenCalledWith('entitlement.would_block', expect.objectContaining({ feature: 'cleanExport' }));
  });

  it('does not even look entitlements up when the mode is off', async () => {
    process.env.ENTITLEMENTS_MODE = 'off';
    const next = jest.fn();

    await requireEntitlement('cleanExport')(mockReq(), {} as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(mockGetEntitlements).not.toHaveBeenCalled();
  });
});

describe('requireQuota', () => {
  it('checks the meter for the amount the request costs', async () => {
    const next = jest.fn();
    const req = mockReq({ body: { sizeBytes: 2048 } } as Partial<Request>);

    await requireQuota('storageBytes', { amount: r => (r.body as { sizeBytes: number }).sizeBytes })(
      req,
      {} as Response,
      next
    );

    expect(mockCheckQuota).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: 'user@example.com', meter: 'storageBytes', amount: 2048, route: '/api/photos' })
    );
    expect(next).toHaveBeenCalledWith();
  });

  it('defaults the amount to one', async () => {
    await requireQuota('trackedTickers')(mockReq(), {} as Response, jest.fn());

    expect(mockCheckQuota).toHaveBeenCalledWith(expect.objectContaining({ amount: 1 }));
  });

  it('forwards a quota rejection to the error handler', async () => {
    const denial = Object.assign(new Error('nope'), { statusCode: 402 });
    mockCheckQuota.mockRejectedValue(denial);
    const next = jest.fn();

    await requireQuota('storageBytes')(mockReq(), {} as Response, next);

    expect(next).toHaveBeenCalledWith(denial);
  });

  it('is inert when the mode is off', async () => {
    process.env.ENTITLEMENTS_MODE = 'off';
    const next = jest.fn();

    await requireQuota('storageBytes')(mockReq(), {} as Response, next);

    expect(mockCheckQuota).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });
});

describe('retentionFloor', () => {
  const now = new Date('2026-08-09T00:00:00.000Z');

  it('returns the cutoff date for a capped plan', async () => {
    const floor = await retentionFloor('user@example.com', now);

    expect(floor).toEqual(new Date('2026-05-11T00:00:00.000Z')); // 90 days back
  });

  it('returns null for an unlimited plan, so no $match is added', async () => {
    mockGetEntitlements.mockResolvedValue(
      entitlements({ planCode: 'family', limits: normalizeLimits({ retentionDays: UNLIMITED }, 'family') })
    );

    expect(await retentionFloor('user@example.com', now)).toBeNull();
  });

  it('never truncates history outside enforce mode', async () => {
    process.env.ENTITLEMENTS_MODE = 'observe';

    expect(await retentionFloor('user@example.com', now)).toBeNull();
  });
});
