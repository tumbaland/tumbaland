/**
 * What happens to a subscription around Stripe: recording its payment, finding
 * the live Stripe copy, cancelling or replacing the ones a new plan supersedes.
 * Used by the checkout and webhook handlers in `stripeController`.
 */
import Stripe from 'stripe';
import { HydratedDocument } from 'mongoose';
import { HttpError, logger } from '@tumbaland/backend-core';
import { stripe, ensureStripe } from './stripeService';
import { Plan, IPlan } from '../models/Plan';
import { Subscription, ISubscription } from '../models/Subscription';
import { Payment } from '../models/Payment';

export function addMonths(date: Date, count: number): Date {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + count);
  return d;
}

// This service pins an older Stripe API version (see stripeService.ts). Both
// helpers below read fields (`invoice.subscription`, `subscription.current_period_end`)
// that were flat on their parent object in that version but have since moved
// in the newer API version the installed SDK's bundled types describe, so
// they aren't visible on Stripe.Invoice / Stripe.Subscription anymore.
export function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | undefined {
  const sub = (invoice as unknown as { subscription?: string | { id: string } }).subscription;
  return typeof sub === 'string' ? sub : sub?.id;
}

export function periodEnd(sub: Stripe.Subscription): Date | undefined {
  const legacy = (sub as unknown as { current_period_end?: number }).current_period_end;
  const seconds = sub.cancel_at ?? legacy ?? sub.items?.data?.[0]?.current_period_end;
  return seconds ? new Date(seconds * 1000) : undefined;
}

export function computeRenewsAtFromSession(session: Stripe.Checkout.Session): Date | undefined {
  // Try to derive from the subscription's current_period_end if expanded; otherwise assume +1 month.
  const sub = typeof session.subscription === 'object'
    ? (session.subscription as unknown as { current_period_end?: number })
    : null;
  if (sub?.current_period_end) {
    return new Date(sub.current_period_end * 1000);
  }
  return addMonths(new Date(), 1);
}

// Create a payment record for an activated subscription if one does not already exist for this cycle.
export async function ensureSubscriptionPayment(
  sub: HydratedDocument<ISubscription>,
  source: { id?: string } | undefined,
  origin: string,
  invoiceId?: string,
  amountOverride?: number,
  currencyOverride?: string
) {
  try {
    // Don't create payments for free plans (0 price)
    const plan = await Plan.findOne({ code: sub.planCode });
    if (!plan) return;
    if (plan.priceMonthlyCents === 0) return;

    // Use invoiceId if provided else session/invoice id; use it to guard duplication
    const keyInvoiceId = invoiceId || source?.id;
    if (keyInvoiceId) {
      const existing = await Payment.findOne({ userEmail: sub.userEmail, type: 'subscription', 'metadata.invoiceId': keyInvoiceId });
      if (existing) return; // already logged
    } else {
      // fallback duplication guard via subscriptionId within recent period
      const existingRecent = await Payment.findOne({ userEmail: sub.userEmail, type: 'subscription', 'metadata.subscriptionId': sub.id }).sort({ createdAt: -1 });
      if (existingRecent) return;
    }

    const amountCents = typeof amountOverride === 'number' ? amountOverride : plan.priceMonthlyCents;
    const currency = currencyOverride || 'eur';
    await Payment.create({
      userEmail: sub.userEmail,
      amountCents,
      currency,
      type: 'subscription',
      status: 'succeeded',
      metadata: {
        origin,
        subscriptionId: sub.id,
        planCode: sub.planCode,
        stripeSubscriptionId: sub.stripeSubscriptionId,
        invoiceId: keyInvoiceId,
      }
    });
  } catch (err) {
    logger.error('[ensureSubscriptionPayment] error', { error: (err as Error)?.message });
  }
}

// Cancel the subscription at Stripe so it stops invoicing. Marking the local document
// `canceled` without doing this leaves the Stripe subscription live and billing, which is
// how a user switching plans ends up paying for both. Kept out of the callers' outer
// try/catch on purpose: a Stripe failure must be distinguishable in logs from a failure to
// read a Plan document, because only one of them charges the customer money.
async function cancelAtStripe(sub: HydratedDocument<ISubscription>, origin: string): Promise<void> {
  if (!sub.stripeSubscriptionId) return;
  try {
    ensureStripe();
    await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
    logger.info(`[${origin}] stripe subscription canceled`, { subId: sub.id, stripeSubscriptionId: sub.stripeSubscriptionId });
  } catch (err) {
    // Already canceled at Stripe is fine; anything else keeps invoicing and must be loud.
    logger.error(`[${origin}] STRIPE CANCEL FAILED - subscription may still be billing`, {
      subId: sub.id,
      userEmail: sub.userEmail,
      planCode: sub.planCode,
      stripeSubscriptionId: sub.stripeSubscriptionId,
      error: err instanceof Error ? err.message : String(err)
    });
  }
}

// Statuses that still grant access and/or still bill. A subscription in any of these must be
// superseded when the user moves to another plan.
const SUPERSEDABLE_STATUSES: ISubscription['status'][] = ['active', 'past_due', 'incomplete', 'canceling'];

/** Statuses whose period the customer has actually paid for. */
const PAID_STATUSES: ISubscription['status'][] = ['active', 'past_due'];

/**
 * The live Stripe-backed subscription a plan switch should modify, if any.
 *
 * Comp grants are excluded deliberately: they are admin grants with no Stripe
 * side, and treating one as "the subscription to change" would have an ordinary
 * purchase silently consume a staff or friend grant.
 */
export async function findLiveStripeSubscription(
  email: string
): Promise<HydratedDocument<ISubscription> | null> {
  return Subscription.findOne({
    userEmail: email.toLowerCase(),
    isComp: { $ne: true },
    stripeSubscriptionId: { $exists: true, $nin: [null, ''] },
    status: { $in: PAID_STATUSES.concat('canceling') }
  });
}

/**
 * Stop a subscription at the end of the period the customer already paid for.
 *
 * This is the *only* way a paid subscription should ever end by the customer's
 * own action. Cancelling at Stripe outright — which the switch-to-free path
 * used to do — revokes access the moment they click, forfeits the remainder of
 * a month they have already been charged for, and directly contradicts what the
 * cancel button and the pricing FAQ both promise.
 */
async function scheduleCancellation(sub: HydratedDocument<ISubscription>, origin: string): Promise<void> {
  if (!sub.stripeSubscriptionId) {
    // Nothing at Stripe to wind down: a comp grant or a never-completed checkout.
    sub.status = 'canceled';
    sub.canceledAt = new Date();
    await sub.save();
    return;
  }

  try {
    ensureStripe();
    const updated = await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true });
    sub.cancelAt = periodEnd(updated) ?? sub.cancelAt;
    sub.status = 'canceling';
    await sub.save();
    logger.info(`[${origin}] subscription set to cancel at period end`, { subId: sub.id, cancelAt: sub.cancelAt });
  } catch (err) {
    // Leave the record alone. Stripe still holds a live subscription that will keep
    // invoicing, so a local-only cancel would revoke access while continuing to charge.
    logger.error(`[${origin}] STRIPE CANCEL FAILED - subscription may still be billing`, {
      subId: sub.id,
      userEmail: sub.userEmail,
      planCode: sub.planCode,
      stripeSubscriptionId: sub.stripeSubscriptionId,
      error: err instanceof Error ? err.message : String(err)
    });
    throw err;
  }
}

/**
 * Wind down every *other* subscription once one becomes the user's plan.
 *
 * Deliberately not price-directional. The two functions this replaces cancelled
 * only the subscriptions priced below (on activation) or above (on switching to
 * free) the new one, which left the paid → paid downgrade uncovered: a Family
 * customer moving to Personal activated the cheaper subscription while Family,
 * being dearer, was never touched and kept invoicing. That is Phase 0's
 * double-billing defect in the other direction, and the price comparison is what
 * produced it — a user has one paid plan, whichever way they move.
 *
 * Comp grants are skipped: an admin grant is not superseded by a purchase.
 */
export async function supersedeOtherSubscriptions(primary: HydratedDocument<ISubscription>): Promise<void> {
  try {
    const others = await Subscription.find({
      userEmail: primary.userEmail,
      _id: { $ne: primary._id },
      isComp: { $ne: true },
      status: { $in: SUPERSEDABLE_STATUSES }
    });

    for (const other of others) {
      // An `incomplete` row was never paid for, so there is no period to protect
      // — dropping it immediately is what keeps abandoned checkouts from piling up.
      if (!PAID_STATUSES.includes(other.status)) {
        await cancelAtStripe(other, 'supersedeOtherSubscriptions');
        other.status = 'canceled';
        other.canceledAt = new Date();
        await other.save();
        continue;
      }

      await scheduleCancellation(other, 'supersedeOtherSubscriptions').catch(() => {
        // Already logged as loudly as it deserves; the primary switch stands.
      });
    }
  } catch (err) {
    logger.error('[supersedeOtherSubscriptions] error', { error: (err as Error)?.message });
  }
}

/**
 * Move an existing Stripe subscription onto another plan, rather than selling a
 * second one alongside it.
 *
 * A plan switch is a change to the subscription the customer already has, and
 * modelling it as a fresh checkout is what made both billing defects possible.
 * Swapping the price in place means there is only ever one subscription to
 * reason about, and `create_prorations` settles the difference in whichever
 * direction it runs: an upgrade is charged for the remainder of the period, a
 * downgrade credits it against what comes next. Nobody pays twice, and nobody
 * loses a period they have already bought.
 */
export async function changePlanInPlace(
  sub: HydratedDocument<ISubscription>,
  plan: HydratedDocument<IPlan> | IPlan,
  priceId: string
): Promise<HydratedDocument<ISubscription>> {
  ensureStripe();

  const current = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId!);
  const itemId = current.items?.data?.[0]?.id;
  if (!itemId) {
    throw new HttpError(502, 'Could not read your current subscription from our payment provider.');
  }

  const updated = await stripe.subscriptions.update(sub.stripeSubscriptionId!, {
    items: [{ id: itemId, price: priceId }],
    proration_behavior: 'create_prorations',
    // Switching plans is also the clearest possible statement that the customer
    // is staying, so a pending cancellation is withdrawn rather than left to
    // silently end the plan they just chose.
    cancel_at_period_end: false
  });

  sub.planCode = plan.code;
  sub.plan = (plan as IPlan)._id as never;
  sub.status = 'active';
  sub.cancelAt = undefined;
  sub.renewsAt = periodEnd(updated) ?? sub.renewsAt;
  await sub.save();

  logger.info('[changePlanInPlace] switched plan on existing subscription', {
    subId: sub.id,
    planCode: plan.code,
    stripeSubscriptionId: sub.stripeSubscriptionId
  });

  return sub;
}
