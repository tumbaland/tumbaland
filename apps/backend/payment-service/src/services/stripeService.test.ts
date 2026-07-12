const ORIGINAL_ENV = process.env;

afterEach(() => {
  process.env = ORIGINAL_ENV;
  jest.resetModules();
});

describe('getStripe / ensureStripe', () => {
  it('throws when STRIPE_SECRET_KEY is not configured', async () => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.STRIPE_SECRET_KEY;

    await jest.isolateModulesAsync(async () => {
      const { ensureStripe } = await import('./stripeService');
      expect(() => ensureStripe()).toThrow('STRIPE_SECRET_KEY not configured');
    });
  });

  it('lazily constructs and caches a single Stripe instance', async () => {
    process.env = { ...ORIGINAL_ENV, STRIPE_SECRET_KEY: 'sk_test_dummy' };

    await jest.isolateModulesAsync(async () => {
      const { getStripe } = await import('./stripeService');
      const first = getStripe();
      const second = getStripe();
      expect(first).toBe(second);
    });
  });

  it('the stripe proxy forwards property access to the lazily-created instance', async () => {
    process.env = { ...ORIGINAL_ENV, STRIPE_SECRET_KEY: 'sk_test_dummy' };

    await jest.isolateModulesAsync(async () => {
      const { stripe } = await import('./stripeService');
      expect(stripe.checkout).toBeDefined();
    });
  });
});
