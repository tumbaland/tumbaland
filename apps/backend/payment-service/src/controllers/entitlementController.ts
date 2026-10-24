import { Request, Response } from 'express';
import { BadRequestError, getUsageSnapshot } from '@tumbaland/backend-core';
import { resolveEntitlements } from '../services/entitlementService';

/**
 * `GET /internal/entitlements?email=` — service-to-service only.
 *
 * payment-service owns entitlement truth; every other service reads it through
 * the cached client in `@tumbaland/backend-core` rather than trusting a JWT
 * claim that would be up to 24h stale in both directions.
 */
export const getEntitlementsByEmail = async (req: Request, res: Response): Promise<void> => {
  const email = (typeof req.query.email === 'string' ? req.query.email : '').trim();
  if (!email) { throw new BadRequestError('email query parameter required'); }

  const entitlements = await resolveEntitlements(email);
  res.json({ success: true, ...entitlements });
};

/**
 * `GET /api/subscriptions/me/usage` — the caller's own plan, limits and live
 * meter readings, for `<UsageMeter>` and the pricing page's "you're using 340
 * MB of 1 GB" line.
 */
export const getMyEntitlements = async (req: Request, res: Response): Promise<void> => {
  const email = req.user!.email;
  const entitlements = await resolveEntitlements(email);
  const usage = await getUsageSnapshot(email);
  res.json({ success: true, ...entitlements, usage });
};
