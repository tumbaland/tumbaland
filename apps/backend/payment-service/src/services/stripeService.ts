import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      throw new Error('STRIPE_SECRET_KEY not configured (ensure .env is loaded before importing stripeService)');
    }
    stripeInstance = new Stripe(secret, { apiVersion: '2025-07-30.basil' as any });
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
