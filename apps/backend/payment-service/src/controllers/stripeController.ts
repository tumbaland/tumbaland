import { Request, Response } from 'express';
import Stripe from 'stripe';
import { BadRequestError, logger, NotFoundError } from '@tumbaland/backend-core';
import { stripe, ensureStripe } from '../services/stripeService';
import { Plan } from '../models/Plan';
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

  // Free plan shortcut: if price is zero OR falsy OR no stripePriceId, activate immediately without Stripe
  if (!plan.priceMonthlyCents || plan.priceMonthlyCents === 0 || !plan.stripePriceId) {
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
    // When switching to free, cancel all other higher-priced subs immediately
    await deactivateHigherPricedSubs(sub);
    // Provide a direct redirect target so frontend can uniformly redirect using url.
    res.status(201).json({ success: true, free: true, subscription: sub, url: '/subscription' });
    return;
  }

  // Find or create a pending subscription (incomplete)
  let sub = await Subscription.findOne({ userEmail: email, planCode: plan.code, status: 'incomplete' });
  if (!sub) {
    sub = await Subscription.create({ userEmail: email, planCode: plan.code, plan: plan._id, status: 'incomplete' });
  }

  const priceId = plan.stripePriceId;
  if (!priceId) { throw new BadRequestError('Plan missing stripePriceId'); }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [ { price: priceId, quantity: 1 } ],
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

  // Idempotency guard: skip if processed
  const store = ensureEventStore();
  if (store.has(event.id)) {
    res.json({ received: true, duplicate: true });
    return;
  }
  store.add(event.id);
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
          await deactivateLowerPricedSubs(sub);
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
          // Update next renewal if provided
          if (invoice.lines?.data?.[0]?.period?.end) {
            sub.renewsAt = new Date(invoice.lines.data[0].period.end * 1000);
            await sub.save();
          }
          await ensureSubscriptionPayment(sub, invoice, 'invoice.payment_succeeded', invoice.id, invoice.amount_paid, invoice.currency);
        }
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
      await deactivateLowerPricedSubs(subscriptionDoc);
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

// Cancel (set status=canceled) any other active/past_due/incomplete/canceling subs for same user that are lower priced than the newly activated one.
async function deactivateLowerPricedSubs(primary: HydratedDocument<ISubscription>) {
  try {
    const primaryPlan = await Plan.findOne({ code: primary.planCode });
    if (!primaryPlan) return;
    const others = await Subscription.find({ userEmail: primary.userEmail, _id: { $ne: primary._id }, status: { $in: SUPERSEDABLE_STATUSES } });
    if (!others.length) return;
    for (const other of others) {
      const otherPlan = await Plan.findOne({ code: other.planCode });
      const otherPrice = otherPlan?.priceMonthlyCents || 0;
      if (otherPrice < primaryPlan.priceMonthlyCents) {
        if (other.status !== 'canceled') {
          await cancelAtStripe(other, 'deactivateLowerPricedSubs');
          other.status = 'canceled';
          other.canceledAt = new Date();
          await other.save();
          logger.info('[deactivateLowerPricedSubs] canceled lower plan', { otherId: other.id, otherPlan: other.planCode, primaryPlan: primary.planCode });
        }
      }
    }
  } catch (err) {
    logger.error('[deactivateLowerPricedSubs] error', { error: (err as Error)?.message });
  }
}

// Cancel any higher-priced active/past_due subscriptions when downgrading (e.g., to free)
async function deactivateHigherPricedSubs(primary: HydratedDocument<ISubscription>) {
  try {
    const primaryPlan = await Plan.findOne({ code: primary.planCode });
    if (!primaryPlan) return;
    const others = await Subscription.find({ userEmail: primary.userEmail, _id: { $ne: primary._id }, status: { $in: SUPERSEDABLE_STATUSES } });
    if (!others.length) return;
    for (const other of others) {
      const otherPlan = await Plan.findOne({ code: other.planCode });
      const otherPrice = otherPlan?.priceMonthlyCents || 0;
      if (otherPrice > (primaryPlan.priceMonthlyCents || 0)) {
        await cancelAtStripe(other, 'deactivateHigherPricedSubs');
        other.status = 'canceled';
        other.canceledAt = new Date();
        await other.save();
        logger.info('[deactivateHigherPricedSubs] canceled higher-priced sub', { otherId: other.id, otherPlan: other.planCode, primaryPlan: primary.planCode });
      }
    }
  } catch (err) {
    logger.error('[deactivateHigherPricedSubs] error', { error: (err as Error)?.message });
  }
}
