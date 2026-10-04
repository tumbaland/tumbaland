import { describe, it, expect, vi, beforeEach, afterAll } from 'vite-plus/test';
import { createPlansService } from './plansService';

const ORIGINAL_FETCH = global.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const limits = {
  meters: { storageBytes: 1024, aiJobs: 25, trackedTickers: 3, seats: 1 },
  features: { cleanExport: false },
  retentionDays: 90
};

const service = createPlansService({ getPaymentApiUrl: () => 'https://payment-api.example' });

beforeEach(() => {
  global.fetch = vi.fn();
});

afterAll(() => {
  global.fetch = ORIGINAL_FETCH;
});

describe('getPlans', () => {
  it('reads the catalog with its resolved limits', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({
        success: true,
        plans: [{ code: 'free', name: 'Free', priceMonthlyCents: 0, effectiveLimits: limits }]
      })
    );

    const plans = await service.getPlans();

    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ code: 'free', effectiveLimits: { retentionDays: 90 } });
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://payment-api.example/api/plans');
  });

  it('drops a plan whose limits did not resolve rather than drawing a card with holes', async () => {
    // Every line on a pricing card is a limit; a plan without them cannot be
    // rendered honestly.
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({
        success: true,
        plans: [
          { code: 'free', name: 'Free', priceMonthlyCents: 0, effectiveLimits: limits },
          { code: 'broken', name: 'Broken', priceMonthlyCents: 100 }
        ]
      })
    );

    expect(await service.getPlans()).toHaveLength(1);
  });

  it('returns an empty catalog rather than throwing when the body carries no plans', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse({ success: true }));

    expect(await service.getPlans()).toEqual([]);
  });

  it('propagates a failed request so the page can say the catalog is unavailable', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse({ message: 'nope' }, 500));

    await expect(service.getPlans()).rejects.toBeTruthy();
  });
});
