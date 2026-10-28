import { Request, Response } from 'express';
import { logger, NotFoundError } from '@tumbaland/backend-core';
import { Subscription } from '../models/Subscription';
import { IPlan } from '../models/Plan';
import { ensureStripe, stripe } from '../services/stripeService';
import { legacyPeriodEnd } from '../services/subscriptionLifecycle';

export const getMySubscription = async (req: Request, res: Response): Promise<void> => {
  const email = req.user!.email;
  const subs = await Subscription.find({ userEmail: email, status: { $in: ['active', 'past_due', 'canceling', 'incomplete'] } })
    .populate<{ plan: IPlan }>('plan');
  if (!subs.length) { res.json({ success: true, subscription: null }); return; }
  const statusRank: Record<string, number> = { active: 4, canceling: 3, past_due: 2, incomplete: 1 };
  const best = subs.sort((a, b) => {
    const priceA = a.plan?.priceMonthlyCents || 0;
    const priceB = b.plan?.priceMonthlyCents || 0;
    if (priceB !== priceA) return priceB - priceA; // higher price first
    const srA = statusRank[a.status] || 0;
    const srB = statusRank[b.status] || 0;
    if (srB !== srA) return srB - srA; // better status first
    return b.createdAt.getTime() - a.createdAt.getTime(); // newer first
  })[0];
  res.json({ success: true, subscription: best });
};

// List all subscriptions (including canceled) for the authenticated user
export const listMySubscriptions = async (req: Request, res: Response): Promise<void> => {
  const email = req.user!.email;
  const subs = await Subscription.find({ userEmail: email }).sort({ createdAt: -1 }).populate('plan');
  res.json({ success: true, subscriptions: subs });
};

export const cancelSubscription = async (req: Request, res: Response): Promise<void> => {
  const email = req.user!.email;
  // Allow cancel for active, past_due, incomplete (user may want to abort a pending checkout).
  // `canceling` is deliberately excluded — that request has already been accepted.
  const sub = await Subscription.findOne({ userEmail: email, status: { $in: ['active','past_due','incomplete'] } });
  if (!sub) { throw new NotFoundError('No cancellable subscription'); }
  logger.info('[cancelSubscription] Found subscription', { id: sub.id, status: sub.status, stripeSub: sub.stripeSubscriptionId, planCode: sub.planCode });

  // If we have a Stripe subscription id and status is active/past_due, request cancel at period end
  if (sub.stripeSubscriptionId && ['active','past_due'].includes(sub.status)) {
    try {
      ensureStripe();
      const updated = await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true });
      // Reflect upcoming cancellation locally. `legacyPeriodEnd` reads the flat
      // `current_period_end` this service's pinned Stripe API version sends.
      const legacyCurrentPeriodEnd = legacyPeriodEnd(updated);
      if (updated.cancel_at) {
        sub.cancelAt = new Date(updated.cancel_at * 1000);
      } else if (legacyCurrentPeriodEnd) {
        sub.cancelAt = new Date(legacyCurrentPeriodEnd * 1000);
      }
      // Stripe was asked to stop at period end, not now — so the user keeps the access they
      // already paid for. `canceledAt` stays unset until the customer.subscription.deleted
      // webhook fires at period end and flips this to `canceled`.
      sub.status = 'canceling';
      await sub.save();
      logger.info('[cancelSubscription] Marked canceling with Stripe', { id: sub.id, cancelAt: sub.cancelAt });
      res.json({ success: true, subscription: sub, stripe: { id: updated.id, cancel_at_period_end: updated.cancel_at_period_end } });
      return;
    } catch (e) {
      // Do NOT mark the record canceled here. Stripe still holds a live subscription that
      // will keep invoicing, so a local-only cancel would revoke access while continuing to
      // charge — strictly worse than reporting the failure and letting the user retry.
      logger.error('[cancelSubscription] STRIPE CANCEL FAILED - subscription left untouched and still billing', {
        id: sub.id,
        userEmail: sub.userEmail,
        planCode: sub.planCode,
        stripeSubscriptionId: sub.stripeSubscriptionId,
        error: e instanceof Error ? e.message : String(e)
      });
      res.status(502).json({
        success: false,
        code: 'STRIPE_CANCEL_FAILED',
        message: 'Could not cancel with our payment provider. Your subscription is unchanged — please try again.'
      });
      return;
    }
  }
  // Incomplete (no active billing yet) or missing stripe id: nothing is being billed, so
  // there is no paid period to preserve — cancel outright.
  sub.status = 'canceled';
  sub.canceledAt = new Date();
  await sub.save();
  logger.info('[cancelSubscription] Canceled locally (no stripe sub)', { id: sub.id });
  res.json({ success: true, subscription: sub });
};
