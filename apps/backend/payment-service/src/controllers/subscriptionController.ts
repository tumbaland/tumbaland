import { Request, Response } from 'express';
import { logger, NotFoundError } from '@tumbaland/backend-core';
import { Subscription } from '../models/Subscription';
import { IPlan } from '../models/Plan';
import { ensureStripe, stripe } from '../services/stripeService';

export const getMySubscription = async (req: Request, res: Response): Promise<void> => {
  const email = req.user!.email;
  const subs = await Subscription.find({ userEmail: email, status: { $in: ['active', 'past_due', 'incomplete'] } })
    .populate<{ plan: IPlan }>('plan');
  if (!subs.length) { res.json({ success: true, subscription: null }); return; }
  const statusRank: Record<string, number> = { active: 3, past_due: 2, incomplete: 1 };
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
  // Allow cancel for active, past_due, incomplete (user may want to abort a pending checkout)
  const sub = await Subscription.findOne({ userEmail: email, status: { $in: ['active','past_due','incomplete'] } });
  if (!sub) { throw new NotFoundError('No cancellable subscription'); }
  logger.info('[cancelSubscription] Found subscription', { id: sub.id, status: sub.status, stripeSub: sub.stripeSubscriptionId, planCode: sub.planCode });

  // If we have a Stripe subscription id and status is active/past_due, request cancel at period end
  if (sub.stripeSubscriptionId && ['active','past_due'].includes(sub.status)) {
    try {
      ensureStripe();
      const updated = await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true });
      // Reflect upcoming cancellation locally. This service pins an older Stripe API
      // version (see stripeService.ts) where `current_period_end` was a flat field on
      // the subscription itself; the installed SDK's bundled types describe a newer
      // version where it moved onto each subscription item, so the field this
      // integration actually relies on isn't visible on Stripe.Subscription anymore.
      const legacyCurrentPeriodEnd = (updated as unknown as { current_period_end?: number }).current_period_end;
      if (updated.cancel_at) {
        sub.cancelAt = new Date(updated.cancel_at * 1000);
      } else if (legacyCurrentPeriodEnd) {
        sub.cancelAt = new Date(legacyCurrentPeriodEnd * 1000);
      }
      // Mark locally as canceled (or you could introduce 'canceling' state; keeping simple)
      sub.status = 'canceled';
      sub.canceledAt = new Date();
      await sub.save();
      logger.info('[cancelSubscription] Marked canceled with Stripe', { id: sub.id, cancelAt: sub.cancelAt });
      res.json({ success: true, subscription: sub, stripe: { id: updated.id, cancel_at_period_end: updated.cancel_at_period_end } });
      return;
    } catch (e) {
      logger.error('Stripe cancel error', { error: e instanceof Error ? e.message : e });
      // Fallback: mark canceled locally anyway
      sub.status = 'canceled';
      sub.canceledAt = new Date();
      await sub.save();
      logger.info('[cancelSubscription] Fallback local cancel only', { id: sub.id });
      res.status(202).json({ success: true, subscription: sub, warning: 'stripe_cancel_failed_local_only' });
      return;
    }
  }
  // Incomplete (no active billing yet) or missing stripe id: just mark canceled
  sub.status = 'canceled';
  sub.canceledAt = new Date();
  await sub.save();
  logger.info('[cancelSubscription] Canceled locally (no stripe sub)', { id: sub.id });
  res.json({ success: true, subscription: sub });
};
