import { Request, Response } from 'express';
import { Subscription } from '../models/Subscription';
import { ensureStripe, stripe } from '../services/stripeService';

export const getMySubscription = (req: Request, res: Response): void => {
  (async () => {
    const email = (req as any).user.email;
    const subs = await Subscription.find({ userEmail: email, status: { $in: ['active', 'past_due', 'incomplete'] } }).populate('plan');
    if (!subs.length) { res.json({ success: true, subscription: null }); return; }
    const statusRank: Record<string, number> = { active: 3, past_due: 2, incomplete: 1 };
    const best = subs.sort((a: any, b: any) => {
      const priceA = (a.plan as any)?.priceMonthlyCents || 0;
      const priceB = (b.plan as any)?.priceMonthlyCents || 0;
      if (priceB !== priceA) return priceB - priceA; // higher price first
      const srA = statusRank[a.status] || 0;
      const srB = statusRank[b.status] || 0;
      if (srB !== srA) return srB - srA; // better status first
      return (b.createdAt as any) - (a.createdAt as any); // newer first
    })[0];
    res.json({ success: true, subscription: best });
  })().catch(err => { console.error('getMySubscription error', err); res.status(500).json({ success: false, message: 'internal error' }); });
};

// List all subscriptions (including canceled) for the authenticated user
export const listMySubscriptions = (req: Request, res: Response): void => {
  (async () => {
    const email = (req as any).user.email;
    const subs = await Subscription.find({ userEmail: email }).sort({ createdAt: -1 }).populate('plan');
    res.json({ success: true, subscriptions: subs });
  })().catch(err => { console.error('listMySubscriptions error', err); res.status(500).json({ success: false, message: 'internal error' }); });
};

export const cancelSubscription = (req: Request, res: Response): void => {
  (async () => {
    const email = (req as any).user.email;
    // Allow cancel for active, past_due, incomplete (user may want to abort a pending checkout)
    const sub = await Subscription.findOne({ userEmail: email, status: { $in: ['active','past_due','incomplete'] } });
    if (!sub) { res.status(404).json({ success: false, message: 'no cancellable subscription' }); return; }
  console.log('[cancelSubscription] Found subscription', { id: sub.id, status: sub.status, stripeSub: sub.stripeSubscriptionId, planCode: sub.planCode });

    // If we have a Stripe subscription id and status is active/past_due, request cancel at period end
    if (sub.stripeSubscriptionId && ['active','past_due'].includes(sub.status)) {
      try {
        ensureStripe();
        const updated = await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true });
        // Reflect upcoming cancellation locally
        if ((updated as any).cancel_at) {
          sub.cancelAt = new Date((updated as any).cancel_at * 1000);
        } else if ((updated as any).current_period_end) {
          sub.cancelAt = new Date((updated as any).current_period_end * 1000);
        }
        // Mark locally as canceled (or you could introduce 'canceling' state; keeping simple)
        sub.status = 'canceled';
        sub.canceledAt = new Date();
        await sub.save();
    console.log('[cancelSubscription] Marked canceled with Stripe', { id: sub.id, cancelAt: sub.cancelAt });
    return res.json({ success: true, subscription: sub, stripe: { id: updated.id, cancel_at_period_end: (updated as any).cancel_at_period_end } });
      } catch (e:any) {
        console.error('Stripe cancel error', e?.message || e);
        // Fallback: mark canceled locally anyway
        sub.status = 'canceled';
        sub.canceledAt = new Date();
        await sub.save();
    console.log('[cancelSubscription] Fallback local cancel only', { id: sub.id });
        return res.status(202).json({ success: true, subscription: sub, warning: 'stripe_cancel_failed_local_only' });
      }
    }
    // Incomplete (no active billing yet) or missing stripe id: just mark canceled
    sub.status = 'canceled';
    sub.canceledAt = new Date();
    await sub.save();
  console.log('[cancelSubscription] Canceled locally (no stripe sub)', { id: sub.id });
    res.json({ success: true, subscription: sub });
  })().catch(err => { console.error('cancelSubscription error', err); res.status(500).json({ success: false, message: 'internal error' }); });
};
