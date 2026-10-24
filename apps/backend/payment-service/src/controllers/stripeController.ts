import { Request, Response } from 'express';
import Stripe from 'stripe';
import { BadRequestError, HttpError, logger, NotFoundError } from '@tumbaland/backend-core';
import { stripe, ensureStripe } from '../services/stripeService';
import { Plan, IPlan } from '../models/Plan';
import { HydratedDocument } from 'mongoose';
import { Subscription, ISubscription } from '../models/Subscription';
import { Payment } from '../models/Payment';
import { ensureEventStore } from '../services/webhookEventStore';

// POST /api/subscriptions/checkout-session
// Body: { planCode: string, successUrl?: string, cancelUrl?: string }
export const createCheckoutSession = async (req: Request, res: Response): Promise<void> => {
  ensureStripe();
  const email = req.user!.email;
  const { planCode, successUrl, cancelUrl } = req.body;
  if (!process.env.PAYMENT_URL && !successUrl) {
    throw new Error('PAYMENT_URL not configured and no successUrl provided');
  }
  const plan = await Plan.findOne({ code: planCode, isActive: true });
  if (!plan) { throw new NotFoundError('Plan not found'); }

  // A plan is free because its **price** is zero — never because its Stripe
  // wiring is missing.
  //
  // This condition used to also match `!plan.stripePriceId`, which meant a
  // priced plan that had not been given a Stripe price yet was activated here
  // for free: `status: 'active'`, renewing monthly, no charge. Since no plan in
  // the database carries a `stripePriceId` until an admin sets one, that made
  // every paid plan claimable at €0 by anyone who could reach this route. It
  // also made the `!priceId` guard below unreachable.
  //
  // A priced plan with no price id is a misconfiguration, and the only safe way
  // to fail on it is loudly — see below.
  if (!plan.priceMonthlyCents || plan.priceMonthlyCents === 0) {
    let sub = await Subscription.findOne({ userEmail: email, planCode: plan.code, status: { $in: ['active','incomplete','past_due','canceling'] } });
    if (!sub) {
      sub = await Subscription.create({ userEmail: email, planCode: plan.code, plan: plan._id, status: 'active', renewsAt: addMonths(new Date(), 1) });
      // Skip creating a payment record for free plan (amount 0) to avoid clutter
    } else {
      sub.status = 'active';
      sub.renewsAt = addMonths(new Date(), 1);
      // Reactivating a `canceling` record must clear its pending end date, or the UI keeps
      // advertising an expiry that no longer applies.
      sub.cancelAt = undefined;
      await sub.save();
    }
    // Switching to free is a cancellation, and it now behaves like one: the paid
    // subscription is set to stop at period end, so the customer keeps what they
    // have already been charged for. It used to cancel at Stripe outright,
    // revoking access on the click and forfeiting the rest of a paid month —
    // the opposite of what the cancel button does for the same intent.
    await supersedeOtherSubscriptions(sub);
    // Provide a direct redirect target so frontend can uniformly redirect using url.
    res.status(201).json({ success: true, free: true, subscription: sub, url: '/subscription' });
    return;
  }

  // Refuse before creating anything. A priced plan with no Stripe price cannot
  // be sold, and the failure belongs to the deployment, not to the caller —
  // hence 503 and an error log naming the plan, rather than a 400 that blames
  // a user who asked for a perfectly valid plan.
  const priceId = plan.stripePriceId;
  if (!priceId) {
    logger.error('[checkout-session] Priced plan has no stripePriceId; refusing to sell it', {
      planCode: plan.code,
      priceMonthlyCents: plan.priceMonthlyCents
    });
    throw new HttpError(503, 'This plan is not available for purchase right now.');
  }

  // A customer who already pays us is *switching*, not buying a second time.
  //
  // Selling them another subscription is what produced the downgrade
  // double-billing: two live subscriptions, and a supersession rule that only
  // looked one way down the price list. Changing the price on the subscription
  // they have means there is never more than one, and Stripe's prorations
  // settle the difference in either direction.
  const existing = await findLiveStripeSubscription(email);
  if (existing) {
    if (existing.planCode === plan.code && existing.status !== 'canceling') {
      throw new BadRequestError(`You are already on the ${plan.name} plan.`);
    }

    const changed = await changePlanInPlace(existing, plan, priceId);
    await supersedeOtherSubscriptions(changed);
    res.status(200).json({ success: true, changed: true, subscription: changed, url: '/subscription' });
    return;
  }

  // Find or create a pending subscription (incomplete)
  let sub = await Subscription.findOne({ userEmail: email, planCode: plan.code, status: 'incomplete' });
  if (!sub) {
    sub = await Subscription.create({ userEmail: email, planCode: plan.code, plan: plan._id, status: 'incomplete' });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [ { price: priceId, quantity: 1 } ],
    // VAT on digital services is due in the *customer's* country, from the
    // first sale, and needs evidence of where they are. Stripe Tax computes and
    // collects it; the billing address is what it computes from, so it has to
    // be required rather than optional. `tax_id_collection` lets a business
    // enter a VAT number and be reverse-charged instead of taxed.
    //
    // Subscription-mode sessions always produce invoices, so nothing extra is
    // needed for the invoice/receipt trail.
    //
    // Requires Stripe Tax to be enabled and an origin address registered in the
    // Stripe dashboard — without that, Stripe rejects the session outright.
    // That is deliberate: silently selling untaxed is the worse failure.
    automatic_tax: { enabled: true },
    billing_address_collection: 'required',
    tax_id_collection: { enabled: true },
    success_url: successUrl || `${process.env.PAYMENT_URL}/subscription/checkout?status=success&session_id={CHECKOUT_SESSION_ID}&plan=${encodeURIComponent(plan.code)}`,
    cancel_url: cancelUrl || `${process.env.PAYMENT_URL}/subscription/checkout?status=cancel&plan=${encodeURIComponent(plan.code)}`,
    client_reference_id: sub.id,
    customer_email: email,
    metadata: { subscriptionId: sub.id, planCode: plan.code }
  });
  const fallbackUrl = (!session.url && session.id?.startsWith('cs_')) ? `https://checkout.stripe.com/c/${session.id}` : session.url;
  if (!fallbackUrl) {
    logger.warn('[checkout-session] Missing session.url', { sessionId: session.id, planCode: plan.code });
  } else {
    logger.info('[checkout-session] Created session', { sessionId: session.id, hasUrl: !!session.url });
  }
  res.status(201).json({ success: true, sessionId: session.id, url: fallbackUrl });
};

// Stripe webhook endpoint
export const stripeWebhook = async (req: Request, res: Response): Promise<void> => {
  ensureStripe();
  const sig = req.headers['stripe-signature'];
  if (!sig) { res.status(400).send('missing signature'); return; }
  let event: Stripe.Event;
  try {
    const raw = req.body;
    if (!Buffer.isBuffer(raw)) {
      throw new Error('Webhook body is not Buffer');
    }
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Webhook signature verification failed', {
      error: message,
      debug: process.env.DEBUG_STRIPE_WEBHOOK === '1',
      hasRaw: Buffer.isBuffer(req.body),
      bodyType: typeof req.body,
      length: Buffer.isBuffer(req.body) ? req.body.length : 'n/a',
      sigHeaderPresent: !!sig
    });
    res.status(400).send(`Webhook Error: ${message}`);
    return;
  }

  // Idempotency guard: skip if processed. The id is only recorded once the
  // event has been handled (at the end of this function). Recording it first
  // meant a handler that threw, on a database blip say, answered 500, and
  // Stripe's retry was then skipped as a duplicate: the payment or the
  // cancellation was never applied.
  const store = ensureEventStore();
  if (await store.has(event.id)) {
    res.json({ received: true, duplicate: true });
    return;
  }
  logger.info('[stripe] event', { eventId: event.id, type: event.type, apiVersion: event.api_version });

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const subscriptionId = session?.metadata?.subscriptionId;
      if (subscriptionId) {
        const sub = await Subscription.findById(subscriptionId);
        if (sub && sub.status === 'incomplete') {
          sub.status = 'active';
          sub.stripeSubscriptionId = session.subscription as string;
          sub.stripeCustomerId = session.customer as string;
          sub.renewsAt = computeRenewsAtFromSession(session);
          await sub.save();
          await supersedeOtherSubscriptions(sub);
          await ensureSubscriptionPayment(sub, session, 'checkout.session.completed');
        }
      }
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const stripeSubId = getInvoiceSubscriptionId(invoice);
      if (stripeSubId) {
        const sub = await Subscription.findOne({ stripeSubscriptionId: stripeSubId });
        // A `canceling` subscription is winding down by design — a failed renewal invoice on
        // it must not resurrect it into a dunning state, or cancellation silently un-cancels.
        if (sub && sub.status !== 'canceled' && sub.status !== 'canceling') {
          sub.status = 'past_due';
          await sub.save();
        }
      }
      break;
    }
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object;
      const stripeSubId = getInvoiceSubscriptionId(invoice);
      if (stripeSubId) {
        const sub = await Subscription.findOne({ stripeSubscriptionId: stripeSubId });
        if (sub) {
          // A paid invoice ends dunning. Without this a renewal that failed once
          // and then went through stayed `past_due` until some later event
          // happened to touch the subscription.
          let changed = false;
          if (sub.status === 'past_due') {
            sub.status = 'active';
            changed = true;
          }
          // Update next renewal if provided
          if (invoice.lines?.data?.[0]?.period?.end) {
            sub.renewsAt = new Date(invoice.lines.data[0].period.end * 1000);
            changed = true;
          }
          if (changed) await sub.save();
          await ensureSubscriptionPayment(sub, invoice, 'invoice.payment_succeeded', invoice.id, invoice.amount_paid, invoice.currency);
        }
      }
      break;
    }
    case 'customer.subscription.updated': {
      // Plan switches now happen *on* the subscription rather than through a new
      // checkout, and a pending cancellation is a field on it — so this is the
      // event that keeps the local record honest. It is also what will carry the
      // billing portal's changes once 5.2 lands, where the user acts entirely
      // outside this service.
      const subscription = event.data.object;
      const sub = await Subscription.findOne({ stripeSubscriptionId: subscription.id });
      if (sub && sub.status !== 'canceled') {
        const priceId = subscription.items?.data?.[0]?.price?.id;
        const plan = priceId ? await Plan.findOne({ stripePriceId: priceId }) : null;
        if (plan && plan.code !== sub.planCode) {
          sub.planCode = plan.code;
          sub.plan = plan._id as never;
        }

        if (subscription.cancel_at_period_end) {
          sub.status = 'canceling';
          sub.cancelAt = periodEnd(subscription) ?? sub.cancelAt;
        } else {
          // Stripe reports `past_due` and `unpaid` for dunning; anything else
          // active-like resolves to active. A local `canceling` that Stripe no
          // longer reports as cancelling has been resumed.
          sub.status = subscription.status === 'past_due' || subscription.status === 'unpaid' ? 'past_due' : 'active';
          sub.cancelAt = undefined;
          sub.renewsAt = periodEnd(subscription) ?? sub.renewsAt;
        }
        await sub.save();
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const stripeSubId = subscription.id;
      const sub = await Subscription.findOne({ stripeSubscriptionId: stripeSubId });
      if (sub && sub.status !== 'canceled') {
        sub.status = 'canceled';
        sub.canceledAt = new Date();
        await sub.save();
      }
      break;
    }
    default:
      break; // ignore others for now
  }
  await store.add(event.id);
  res.json({ received: true });
};

// GET /api/subscriptions/checkout-session/:id -> fetch session status and related subscription
export const getCheckoutSessionStatus = async (req: Request, res: Response): Promise<void> => {
  ensureStripe();
  const { id } = req.params;
  if (!id) { throw new BadRequestError('id required'); }
  const session = await stripe.checkout.sessions.retrieve(id as string, { expand: ['subscription'] });
  const subscriptionId = session.metadata?.subscriptionId;
  let subscriptionDoc = null;
  if (subscriptionId) {
    subscriptionDoc = await Subscription.findById(subscriptionId);
    // Auto-heal: if session paid/complete but local sub stuck incomplete, activate.
    if (subscriptionDoc && subscriptionDoc.status === 'incomplete' && session.status === 'complete' && session.payment_status === 'paid') {
      logger.info('[auto-heal] Activating subscription', { subscriptionId: subscriptionDoc.id, sessionId: session.id });
      subscriptionDoc.status = 'active';
      const expandedSub = typeof session.subscription === 'object' ? session.subscription : null;
      subscriptionDoc.stripeSubscriptionId = expandedSub?.id || subscriptionDoc.stripeSubscriptionId;
      subscriptionDoc.stripeCustomerId = (session.customer as string) || subscriptionDoc.stripeCustomerId;
      subscriptionDoc.renewsAt = computeRenewsAtFromSession(session);
      await subscriptionDoc.save();
      await supersedeOtherSubscriptions(subscriptionDoc);
      await ensureSubscriptionPayment(subscriptionDoc, session, 'auto_heal');
    }
  }
  res.json({ success: true, status: session.status, payment_status: session.payment_status, subscription: subscriptionDoc });
};

// Helpers
function addMonths(date: Date, count: number): Date {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + count);
  return d;
}

// This service pins an older Stripe API version (see stripeService.ts). Both
// helpers below read fields (`invoice.subscription`, `subscription.current_period_end`)
// that were flat on their parent object in that version but have since moved
// in the newer API version the installed SDK's bundled types describe, so
// they aren't visible on Stripe.Invoice / Stripe.Subscription anymore.
function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | undefined {
  const sub = (invoice as unknown as { subscription?: string | { id: string } }).subscription;
  return typeof sub === 'string' ? sub : sub?.id;
}

function periodEnd(sub: Stripe.Subscription): Date | undefined {
  const legacy = (sub as unknown as { current_period_end?: number }).current_period_end;
  const seconds = sub.cancel_at ?? legacy ?? sub.items?.data?.[0]?.current_period_end;
  return seconds ? new Date(seconds * 1000) : undefined;
}

function computeRenewsAtFromSession(session: Stripe.Checkout.Session): Date | undefined {
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
async function ensureSubscriptionPayment(
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
async function findLiveStripeSubscription(
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
async function supersedeOtherSubscriptions(primary: HydratedDocument<ISubscription>): Promise<void> {
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
async function changePlanInPlace(
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
