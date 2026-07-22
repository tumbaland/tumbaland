import Stripe from 'stripe';

// Pinned to a specific API version older than this SDK's bundled
// `apiVersion` type literal (which tracks the latest version, not
// necessarily the one this integration was built against), hence the cast
// derived from the constructor's own config type rather than `any`.
type StripeApiVersion = NonNullable<ConstructorParameters<typeof Stripe>[1]>['apiVersion'];

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      throw new Error('STRIPE_SECRET_KEY not configured (ensure .env is loaded before importing stripeService)');
    }
    stripeInstance = new Stripe(secret, { apiVersion: '2025-07-30.basil' as StripeApiVersion });
  }
  return stripeInstance;
}

export function ensureStripe() {
  getStripe();
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const inst = getStripe();
    // @ts-expect-error dynamic access
    return inst[prop];
  }
});
