import { isPaymentRequired, paywallMessage } from './paywall';

const quotaError = (body: Record<string, unknown>) => ({ status: 402, body });

describe('isPaymentRequired', () => {
  it('recognizes a 402 and nothing else', () => {
    expect(isPaymentRequired(quotaError({}))).toBe(true);
    expect(isPaymentRequired({ status: 403 })).toBe(false);
    expect(isPaymentRequired(new Error('offline'))).toBe(false);
    expect(isPaymentRequired(undefined)).toBe(false);
  });
});

describe('paywallMessage', () => {
  it('keeps the caller\'s message for anything that is not a paywall', () => {
    expect(paywallMessage(new Error('offline'), 'Failed to save ticker')).toBe('Failed to save ticker');
  });

  it('names the meter, the ceiling and the plan that lifts it', () => {
    const message = paywallMessage(
      quotaError({ code: 'QUOTA_EXCEEDED', meter: 'trackedTickers', used: 3, limit: 3, planCode: 'free', upgradeTo: 'support' }),
      'Failed to save ticker'
    );

    expect(message).toBe('You have reached the tracked tickers limit (3) on your free plan. Upgrade to support for more.');
  });

  it('degrades gracefully when the body carries no detail', () => {
    expect(paywallMessage(quotaError({}), 'Failed to save ticker')).toBe(
      'You have reached a plan limit on your current plan.'
    );
  });

  it('falls back to the raw meter key for a meter it has no label for', () => {
    expect(paywallMessage(quotaError({ meter: 'somethingNew' }), 'nope')).toContain('somethingNew');
  });
});
