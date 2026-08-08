import { Request, Response } from 'express';
import { logger, BadRequestError, NotFoundError } from '@tumbaland/backend-core';
import { Subscription } from '../models/Subscription';
import { Plan } from '../models/Plan';
import { ENTITLED_STATUSES } from '../services/entitlementService';

/**
 * Comp grants: a subscription an admin hands out instead of selling.
 *
 * Deliberately the same Subscription document a paying customer gets, with
 * `isComp` set and no Stripe ids — so staff and comped friends resolve
 * entitlements through the identical code path as a customer, and the only
 * special case in the whole system is a boolean on one document.
 */

/** Every grant, newest first. The admin front's list view. */
export const listGrants = async (_req: Request, res: Response): Promise<void> => {
  const grants = await Subscription.find({ isComp: true }).sort({ createdAt: -1 }).populate('plan');
  res.json({ success: true, grants });
};

export const grantSubscription = async (req: Request, res: Response): Promise<void> => {
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const { planCode, reason, expiresAt } = req.body as { planCode: string; reason?: string; expiresAt?: string };

  const plan = await Plan.findOne({ code: planCode });
  if (!plan) { throw new NotFoundError(`Plan not found: ${planCode}`); }

  const expires = expiresAt ? new Date(expiresAt) : undefined;
  if (expires && Number.isNaN(expires.getTime())) { throw new BadRequestError('expiresAt is not a valid date'); }

  // One comp per user: re-granting moves the existing record to the new plan
  // rather than stacking a second one that `pickBest` would then have to
  // arbitrate between.
  const existing = await Subscription.findOne({ userEmail: email, isComp: true });
  const grant = existing ?? new Subscription({ userEmail: email, isComp: true });

  grant.planCode = plan.code;
  grant.plan = plan._id as typeof grant.plan;
  grant.status = 'active';
  grant.grantedBy = req.user!.email;
  grant.grantReason = reason;
  grant.expiresAt = expires;
  // A re-grant after a revoke is a fresh grant; clear the tombstone.
  grant.canceledAt = undefined;
  grant.cancelAt = undefined;
  await grant.save();

  logger.info('[grantSubscription] Comp granted', {
    email,
    planCode: plan.code,
    grantedBy: grant.grantedBy,
    expiresAt: grant.expiresAt,
    reactivated: Boolean(existing)
  });

  res.status(existing ? 200 : 201).json({ success: true, grant });
};

export const revokeGrant = async (req: Request, res: Response): Promise<void> => {
  const email = String(req.params.email ?? '').trim().toLowerCase();

  const grant = await Subscription.findOne({ userEmail: email, isComp: true, status: { $in: ENTITLED_STATUSES } });
  if (!grant) { throw new NotFoundError('No active grant for that user'); }

  // Revoked outright, not at period end: nothing was ever paid for, so there is
  // no paid period to preserve.
  grant.status = 'canceled';
  grant.canceledAt = new Date();
  await grant.save();

  logger.info('[revokeGrant] Comp revoked', { email, revokedBy: req.user!.email, planCode: grant.planCode });

  res.json({ success: true, grant });
};
