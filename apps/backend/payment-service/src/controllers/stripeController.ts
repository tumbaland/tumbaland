import { Request, Response } from 'express';
import { stripe, ensureStripe } from '../services/stripeService';
import { Plan } from '../models/Plan';
import { Subscription } from '../models/Subscription';
import { Payment } from '../models/Payment';
import { ensureEventStore } from '../services/webhookEventStore';

// POST /api/subscriptions/checkout-session
// Body: { planCode: string, successUrl?: string, cancelUrl?: string }
export const createCheckoutSession = (req: Request, res: Response): void => {
  (async () => {
    ensureStripe();
    const email = req.user!.email;
    const { planCode, successUrl, cancelUrl } = req.body;
    if (!planCode) { res.status(400).json({ success: false, message: 'planCode required' }); return; }
    if (!process.env.PAYMENT_URL && !successUrl) {
      res.status(500).json({ success: false, message: 'PAYMENT_URL not configured and no successUrl provided' });
      return;
    }
    const plan = await Plan.findOne({ code: planCode, isActive: true });
    if (!plan) { res.status(404).json({ success: false, message: 'plan not found' }); return; }

    // Free plan shortcut: if price is zero OR falsy OR no stripePriceId, activate immediately without Stripe
    if (!plan.priceMonthlyCents || plan.priceMonthlyCents === 0 || !plan.stripePriceId) {
      let sub = await Subscription.findOne({ userEmail: email, planCode: plan.code, status: { $in: ['active','incomplete','past_due'] } });
      if (!sub) {
        sub = await Subscription.create({ userEmail: email, planCode: plan.code, plan: plan._id, status: 'active', renewsAt: addMonths(new Date(), 1) });
  // Skip creating a payment record for free plan (amount 0) to avoid clutter
      } else {
        sub.status = 'active';
        sub.renewsAt = addMonths(new Date(), 1);
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

  const priceId = (plan as any).stripePriceId;
  if (!priceId) { res.status(400).json({ success: false, message: 'plan missing stripePriceId' }); return; }

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
      console.warn('[checkout-session] Missing session.url', { sessionId: session.id, planCode: plan.code });
    } else {
      console.log('[checkout-session] Created session', { sessionId: session.id, hasUrl: !!session.url });
    }
    res.status(201).json({ success: true, sessionId: session.id, url: fallbackUrl });
  })().catch(err => { console.error('createCheckoutSession error', err); res.status(500).json({ success: false, message: 'internal error' }); });
};

// Stripe webhook endpoint
export const stripeWebhook = (req: Request, res: Response): void => {
  (async () => {
    ensureStripe();
  const sig = req.headers['stripe-signature'];
    if (!sig) { res.status(400).send('missing signature'); return; }
    let event: any;
    try {
      const raw = req.body as any;
      if (!Buffer.isBuffer(raw)) {
        throw new Error('Webhook body is not Buffer');
      }
      event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch (err: any) {
      console.error('Webhook signature verification failed', err.message, {
        debug: process.env.DEBUG_STRIPE_WEBHOOK === '1',
        hasRaw: Buffer.isBuffer((req as any).body),
        bodyType: typeof (req as any).body,
        length: Buffer.isBuffer((req as any).body) ? (req as any).body.length : 'n/a',
        sigHeaderPresent: !!sig
      });
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    // Idempotency guard: skip if processed
    const store = ensureEventStore();
    if (store.has(event.id)) {
      return res.json({ received: true, duplicate: true });
    }
    store.add(event.id);
    console.log('[stripe] event', event.id, event.type, 'apiVersion', event.api_version);

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
        const stripeSubId = invoice.subscription as string | undefined;
        if (stripeSubId) {
          const sub = await Subscription.findOne({ stripeSubscriptionId: stripeSubId });
          if (sub && sub.status !== 'canceled') {
            sub.status = 'past_due';
            await sub.save();
          }
        }
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const stripeSubId = invoice.subscription as string | undefined;
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
  })().catch(err => { console.error('stripeWebhook error', err); res.status(500).json({ success: false }); });
};

// GET /api/subscriptions/checkout-session/:id -> fetch session status and related subscription
export const getCheckoutSessionStatus = (req: Request, res: Response): void => {
  (async () => {
    ensureStripe();
    const { id } = req.params;
    if (!id) { res.status(400).json({ success: false, message: 'id required' }); return; }
    const session = await stripe.checkout.sessions.retrieve(id as string, { expand: ['subscription'] });
    const subscriptionId = session.metadata?.subscriptionId;
    let subscriptionDoc = null;
    if (subscriptionId) {
      subscriptionDoc = await Subscription.findById(subscriptionId);
      // Auto-heal: if session paid/complete but local sub stuck incomplete, activate.
      if (subscriptionDoc && subscriptionDoc.status === 'incomplete' && session.status === 'complete' && session.payment_status === 'paid') {
        console.log('[auto-heal] Activating subscription', { subscriptionId: subscriptionDoc.id, sessionId: session.id });
        subscriptionDoc.status = 'active';
        subscriptionDoc.stripeSubscriptionId = (session.subscription as any)?.id || subscriptionDoc.stripeSubscriptionId;
        subscriptionDoc.stripeCustomerId = (session.customer as string) || subscriptionDoc.stripeCustomerId;
        subscriptionDoc.renewsAt = computeRenewsAtFromSession(session);
        await subscriptionDoc.save();
    await deactivateLowerPricedSubs(subscriptionDoc);
    await ensureSubscriptionPayment(subscriptionDoc, session, 'auto_heal');
      }
    }
    res.json({ success: true, status: session.status, payment_status: session.payment_status, subscription: subscriptionDoc });
  })().catch(err => { console.error('getCheckoutSessionStatus error', err); res.status(500).json({ success: false, message: 'internal error' }); });
};

// Helpers
function addMonths(date: Date, count: number): Date {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + count);
  return d;
}

function computeRenewsAtFromSession(session: any): Date | undefined {
  // Try to derive from subscription current_period_end if expanded; otherwise assume +1 month
  const sub = session.subscription as any;
  if (sub && typeof sub === 'object' && sub.current_period_end) {
    return new Date(sub.current_period_end * 1000);
  }
  return addMonths(new Date(), 1);
}

// Create a payment record for an activated subscription if one does not already exist for this cycle.
async function ensureSubscriptionPayment(sub: any, source: any, origin: string, invoiceId?: string, amountOverride?: number, currencyOverride?: string) {
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
    console.error('[ensureSubscriptionPayment] error', err);
  }
}

// Cancel (set status=canceled) any other active/past_due/incomplete subs for same user that are lower priced than the newly activated one.
async function deactivateLowerPricedSubs(primary: any) {
  try {
    const primaryPlan = await Plan.findOne({ code: primary.planCode });
    if (!primaryPlan) return;
    const others = await Subscription.find({ userEmail: primary.userEmail, _id: { $ne: primary._id }, status: { $in: ['active','past_due','incomplete'] } });
    if (!others.length) return;
    for (const other of others) {
      const otherPlan = await Plan.findOne({ code: other.planCode });
      const otherPrice = otherPlan?.priceMonthlyCents || 0;
      if (otherPrice < primaryPlan.priceMonthlyCents) {
        if (other.status !== 'canceled') {
          other.status = 'canceled';
          other.canceledAt = new Date();
          await other.save();
          console.log('[deactivateLowerPricedSubs] canceled lower plan', { otherId: other.id, otherPlan: other.planCode, primaryPlan: primary.planCode });
        }
      }
    }
  } catch (err) {
    console.error('[deactivateLowerPricedSubs] error', err);
  }
}

// Cancel any higher-priced active/past_due subscriptions when downgrading (e.g., to free)
async function deactivateHigherPricedSubs(primary: any) {
  try {
    const primaryPlan = await Plan.findOne({ code: primary.planCode });
    if (!primaryPlan) return;
    const others = await Subscription.find({ userEmail: primary.userEmail, _id: { $ne: primary._id }, status: { $in: ['active','past_due','incomplete'] } });
    if (!others.length) return;
    for (const other of others) {
      const otherPlan = await Plan.findOne({ code: other.planCode });
      const otherPrice = otherPlan?.priceMonthlyCents || 0;
      if (otherPrice > (primaryPlan.priceMonthlyCents || 0)) {
        if (other.stripeSubscriptionId) {
          try {
            ensureStripe();
            await stripe.subscriptions.cancel(other.stripeSubscriptionId);
          } catch (e:any) {
            console.warn('[deactivateHigherPricedSubs] stripe cancel failed', { subId: other.id, err: e?.message });
          }
        }
        other.status = 'canceled';
        other.canceledAt = new Date();
        await other.save();
        console.log('[deactivateHigherPricedSubs] canceled higher-priced sub', { otherId: other.id, otherPlan: other.planCode, primaryPlan: primary.planCode });
      }
    }
  } catch (err) {
    console.error('[deactivateHigherPricedSubs] error', err);
  }
}
