import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { createEntitlementsService, isUnlimited, usageRatio, UNLIMITED } from './entitlementsService';

const ORIGINAL_FETCH = global.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const limits = {
  meters: { storageBytes: 1024, aiJobs: 25, trackedTickers: 3, seats: 1 },
  features: { cleanExport: false },
  retentionDays: 90
};

const service = createEntitlementsService({ getPaymentApiUrl: () => 'https://payment-api.example' });

beforeEach(() => {
  global.fetch = vi.fn();
});

afterAll(() => {
  global.fetch = ORIGINAL_FETCH;
});

describe('getMyEntitlements', () => {
  it('reads the caller"s plan, limits and live usage', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({
        success: true,
        email: 'u@example.com',
        planCode: 'personal',
        status: 'active',
        limits,
        usage: { storageBytes: 512 }
      })
    );

    const result = await service.getMyEntitlements();

    expect(global.fetch).toHaveBeenCalledWith(
      'https://payment-api.example/api/subscriptions/me/entitlements',
      expect.objectContaining({ credentials: 'include' })
    );
    expect(result.planCode).toBe('personal');
    expect(result.usage.storageBytes).toBe(512);
  });

  it('fills meters absent from the snapshot with zero rather than undefined', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ planCode: 'free', status: null, limits, usage: { storageBytes: 10 } })
    );

    const result = await service.getMyEntitlements();

    // A meter with no counter yet is simply missing, which would otherwise
    // render as "undefined of 3".
    expect(result.usage.trackedTickers).toBe(0);
    expect(result.usage.seats).toBe(0);
  });

  it('rejects a response with no limits instead of returning a half-built object', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse({ success: false }));

    // Returning a truthy Entitlements with undefined `limits` would push the
    // crash into every call site's property access instead of failing once.
    await expect(service.getMyEntitlements()).rejects.toThrow(/missing limits/);
  });
});

describe('isUnlimited', () => {
  it('treats the sentinel and any negative as unlimited', () => {
    expect(isUnlimited(UNLIMITED)).toBe(true);
    expect(isUnlimited(-99)).toBe(true);
    expect(isUnlimited(0)).toBe(false);
    expect(isUnlimited(1024)).toBe(false);
  });
});

describe('usageRatio', () => {
  it('reports the consumed share, clamped to the bar"s range', () => {
    expect(usageRatio(50, 100)).toBe(0.5);
    expect(usageRatio(300, 100)).toBe(1);
    expect(usageRatio(-5, 100)).toBe(0);
  });

  it('reports zero for an unlimited meter, which has no ceiling to be a fraction of', () => {
    expect(usageRatio(9999, UNLIMITED)).toBe(0);
  });

  it('does not divide by zero', () => {
    expect(usageRatio(5, 0)).toBe(0);
  });
});
