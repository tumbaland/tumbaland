jest.mock('../logging/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), http: jest.fn() }
}));

import logger from '../logging/logger';
import { clearEntitlementsCache, getEntitlements, invalidateEntitlements } from './client';
import { DEFAULT_PLAN_LIMITS } from './definitions';

const ORIGINAL_ENV = process.env;
const ORIGINAL_FETCH = global.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function paidResponse() {
  return jsonResponse({
    success: true,
    planCode: 'personal',
    status: 'active',
    limits: { meters: { storageBytes: 12345 } },
    upgradeTo: 'family'
  });
}

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    PAYMENT_API_URL: 'http://payment-service:5005',
    INTERNAL_SERVICE_TOKEN: 'test-internal-token',
    SERVICE_NAME: 'album-service'
  };
  clearEntitlementsCache();
  global.fetch = jest.fn();
  (logger.error as jest.Mock).mockClear();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
  global.fetch = ORIGINAL_FETCH;
});

describe('getEntitlements', () => {
  it('calls the internal endpoint with the service token and normalizes the answer', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(paidResponse());

    const result = await getEntitlements('User@Example.com');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://payment-service:5005/internal/entitlements?email=user%40example.com',
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-internal-token': 'test-internal-token', 'x-service-id': 'album-service' })
      })
    );
    expect(result.planCode).toBe('personal');
    expect(result.upgradeTo).toBe('family');
    expect(result.limits.meters.storageBytes).toBe(12345);
    // Keys the payload omitted are filled from that plan's defaults rather than
    // arriving undefined and comparing as NaN inside a quota check.
    expect(result.limits.meters.seats).toBe(DEFAULT_PLAN_LIMITS.personal.meters.seats);
    expect(result.stale).toBeUndefined();
  });

  it('serves the cached answer within the TTL and refetches after it', async () => {
    jest.useFakeTimers();
    try {
      (global.fetch as jest.Mock).mockResolvedValue(paidResponse());

      await getEntitlements('user@example.com');
      await getEntitlements('user@example.com');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(60_001);
      await getEntitlements('user@example.com');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('treats casing and surrounding whitespace as the same user', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(paidResponse());

    await getEntitlements('user@example.com');
    await getEntitlements('  User@Example.COM ');

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('collapses a concurrent burst for one user into a single request', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(paidResponse());

    await Promise.all(Array.from({ length: 10 }, () => getEntitlements('user@example.com')));

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('drops the cached answer on invalidate', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(paidResponse());

    await getEntitlements('user@example.com');
    invalidateEntitlements('User@example.com');
    await getEntitlements('user@example.com');

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('when payment-service cannot be reached', () => {
  it('fails closed to free limits rather than handing out the product', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await getEntitlements('user@example.com');

    expect(result.planCode).toBe('free');
    expect(result.limits).toEqual(DEFAULT_PLAN_LIMITS.free);
    expect(result.stale).toBe(true);
    expect(logger.error).toHaveBeenCalled();
  });

  it('fails closed on a non-2xx answer too', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({ success: false }, 500));

    const result = await getEntitlements('user@example.com');

    expect(result.planCode).toBe('free');
    expect(result.stale).toBe(true);
  });

  it('never caches a fallback, so recovery is immediate rather than a minute later', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('ECONNREFUSED')).mockResolvedValue(paidResponse());

    const failed = await getEntitlements('user@example.com');
    const recovered = await getEntitlements('user@example.com');

    expect(failed.stale).toBe(true);
    expect(recovered.planCode).toBe('personal');
  });

  it('fails closed without calling out at all when the channel is unconfigured', async () => {
    delete process.env.PAYMENT_API_URL;

    const result = await getEntitlements('user@example.com');

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.planCode).toBe('free');
    expect(result.stale).toBe(true);
    expect(logger.error).toHaveBeenCalledWith('Entitlement lookup not configured', expect.anything());
  });
});

describe('base URL selection', () => {
  it('prefers the container-network address over the public hostname', async () => {
    process.env.PAYMENT_INTERNAL_URL = 'http://payment-service:5005';
    process.env.PAYMENT_API_URL = 'https://payment-api.tumbaland.eu';
    (global.fetch as jest.Mock).mockResolvedValue(paidResponse());

    await getEntitlements('user@example.com');

    // payment-front templates the public variable into the browser's
    // config.json, so it cannot be pointed inward — hence the second variable.
    expect(global.fetch).toHaveBeenCalledWith(
      'http://payment-service:5005/internal/entitlements?email=user%40example.com',
      expect.anything()
    );
  });

  it('falls back to the public URL, so local dev and un-migrated deploys still work', async () => {
    delete process.env.PAYMENT_INTERNAL_URL;
    process.env.PAYMENT_API_URL = 'https://payment-api.tumbaland.eu';
    (global.fetch as jest.Mock).mockResolvedValue(paidResponse());

    await getEntitlements('user@example.com');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://payment-api.tumbaland.eu/internal/entitlements?email=user%40example.com',
      expect.anything()
    );
  });
});

describe('cache bounds', () => {
  it('evicts the oldest entries instead of growing without limit', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(paidResponse());

    for (let i = 0; i < 5_001; i++) {
      await getEntitlements(`user${i}@example.com`);
    }
    const callsAfterFill = (global.fetch as jest.Mock).mock.calls.length;

    // The very first user was evicted by the 5001st, so this is a refetch.
    await getEntitlements('user0@example.com');
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsAfterFill + 1);

    // The most recent user is still cached.
    await getEntitlements('user5000@example.com');
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsAfterFill + 1);
  });
});
