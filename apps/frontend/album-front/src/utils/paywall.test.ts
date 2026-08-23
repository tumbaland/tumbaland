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
    expect(paywallMessage(new Error('offline'), 'Failed to upload photo.jpg')).toBe('Failed to upload photo.jpg');
  });

  it('renders the storage ceiling in bytes a person can read', () => {
    // "1073741824" is a number nobody can decide about.
    const message = paywallMessage(
      quotaError({ code: 'QUOTA_EXCEEDED', meter: 'storageBytes', used: 1_000_000_000, limit: 1_073_741_824, planCode: 'free', upgradeTo: 'support' }),
      'Failed to upload photo.jpg'
    );

    expect(message).toBe('You have reached the storage limit (1 GB) on your free plan. Upgrade to support for more.');
  });

  it('leaves a counted meter as a plain number', () => {
    expect(paywallMessage(quotaError({ meter: 'seats', limit: 5, planCode: 'support' }), 'nope')).toBe(
      'You have reached the group seats limit (5) on your support plan.'
    );
  });

  it('degrades gracefully when the body carries no detail', () => {
    expect(paywallMessage(quotaError({}), 'Failed to upload photo.jpg')).toBe(
      'You have reached a plan limit on your current plan.'
    );
  });

  it('falls back to the raw meter key for a meter it has no label for', () => {
    expect(paywallMessage(quotaError({ meter: 'somethingNew' }), 'nope')).toContain('somethingNew');
  });
});
