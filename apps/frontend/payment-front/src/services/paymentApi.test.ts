import { vi } from 'vitest';

vi.mock('../config/ConfigProvider', () => ({
  getGlobalConfig: () => ({
    PAYMENT_API_URL: 'http://localhost:4005',
    AUTH_FRONT_URL: 'http://localhost:3004'
  })
}));

import { paymentApi } from './paymentApi';

function mockFetchOnce(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const { ok = true, status = 200 } = init;
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok, status, json: async () => body } as Response);
}

describe('paymentApi.listPlans', () => {
  it('unwraps the plans array', async () => {
    mockFetchOnce({ success: true, plans: [{ code: 'pro' }] });
    expect(await paymentApi.listPlans()).toEqual([{ code: 'pro' }]);
  });
});

describe('paymentApi.createCheckoutSession', () => {
  it('POSTs the plan code and URLs', async () => {
    mockFetchOnce({ sessionId: 's1', url: 'https://stripe.example' });
    const result = await paymentApi.createCheckoutSession('pro', 'https://ok', 'https://cancel');

    expect(result).toEqual({ sessionId: 's1', url: 'https://stripe.example' });
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init).toMatchObject({ method: 'POST', body: JSON.stringify({ planCode: 'pro', successUrl: 'https://ok', cancelUrl: 'https://cancel' }) });
  });

  it('preserves the wrapper for a free-plan checkout (no status fields, but a `free` flag)', async () => {
    mockFetchOnce({ free: true, subscription: { planCode: 'free', status: 'active' } });
    const result = await paymentApi.createCheckoutSession('free');
    expect(result).toMatchObject({ free: true, subscription: { planCode: 'free' } });
  });

  it('unwraps to the bare subscription when there is no session/free wrapper info', async () => {
    mockFetchOnce({ subscription: { planCode: 'pro', status: 'active' } });
    const result = await paymentApi.getMySubscription();
    expect(result).toEqual({ planCode: 'pro', status: 'active' });
  });
});

describe('paymentApi.getCheckoutSessionStatus', () => {
  it('preserves the full wrapper when both status and payment_status are present', async () => {
    mockFetchOnce({ status: 'complete', payment_status: 'paid', subscription: { planCode: 'pro' } });
    const result = await paymentApi.getCheckoutSessionStatus('sess1');
    expect(result).toEqual({ status: 'complete', payment_status: 'paid', subscription: { planCode: 'pro' } });
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/subscriptions/checkout-session/sess1');
  });
});

describe('paymentApi.getMySubscription', () => {
  it('returns null when there is no subscription', async () => {
    mockFetchOnce({ subscription: null });
    expect(await paymentApi.getMySubscription()).toBeNull();
  });
});

describe('paymentApi.listMySubscriptions', () => {
  it('unwraps the subscriptions array', async () => {
    mockFetchOnce({ subscriptions: [{ planCode: 'pro' }] });
    expect(await paymentApi.listMySubscriptions()).toEqual([{ planCode: 'pro' }]);
  });
});

describe('paymentApi.cancelSubscription', () => {
  it('POSTs and unwraps the resulting subscription', async () => {
    mockFetchOnce({ subscription: { planCode: 'pro', status: 'canceled' } });
    const result = await paymentApi.cancelSubscription();
    expect(result).toEqual({ planCode: 'pro', status: 'canceled' });
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init).toMatchObject({ method: 'POST' });
  });
});

describe('paymentApi.createOneTime', () => {
  it('POSTs the amount and currency, defaulting currency to eur', async () => {
    mockFetchOnce({ payment: { _id: 'p1' } });
    const result = await paymentApi.createOneTime(500);
    expect(result).toEqual({ _id: 'p1' });
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init!.body as string)).toEqual({ amountCents: 500, currency: 'eur' });
  });

  it('accepts an explicit currency', async () => {
    mockFetchOnce({ payment: { _id: 'p1' } });
    await paymentApi.createOneTime(500, 'usd');
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init!.body as string)).toMatchObject({ currency: 'usd' });
  });
});

describe('paymentApi.listMyPayments', () => {
  it('unwraps the payments array', async () => {
    mockFetchOnce({ payments: [{ _id: 'p1' }] });
    expect(await paymentApi.listMyPayments()).toEqual([{ _id: 'p1' }]);
  });
});

describe('unwrap fallback', () => {
  it('returns the raw body when no known wrapper key is present', async () => {
    mockFetchOnce({ success: true });
    const result = await paymentApi.getMySubscription();
    expect(result).toEqual({ success: true });
  });
});

describe('onUnauthorized', () => {
  it('redirects to the auth front on a 401 response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'unauthorized' })
    }) as unknown as typeof fetch;
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', { writable: true, value: { ...originalLocation, href: 'https://app.example/plans' } });

    await expect(paymentApi.listPlans()).rejects.toThrow();

    expect(window.location.href).toContain('redirect_uri=');
    Object.defineProperty(window, 'location', { writable: true, value: originalLocation });
  });
});
