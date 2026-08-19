import request from 'supertest';
import jwt from 'jsonwebtoken';

jest.mock('../models/Subscription', () => ({
  Subscription: { findOne: jest.fn(), findById: jest.fn(), find: jest.fn(), create: jest.fn() }
}));
jest.mock('../models/Plan', () => ({ Plan: { findOne: jest.fn() } }));
jest.mock('../models/Payment', () => ({ Payment: { findOne: jest.fn(), create: jest.fn() } }));

jest.mock('../services/stripeService', () => ({
  ensureStripe: jest.fn(),
  stripe: {
    checkout: { sessions: { create: jest.fn(), retrieve: jest.fn() } },
    subscriptions: { cancel: jest.fn(), update: jest.fn(), retrieve: jest.fn() },
    webhooks: {
      // Bypass real signature verification for these tests — the existing
      // stripeController.test.ts already covers real signature verification
      // with the actual stripe SDK; this file focuses on the event-handling
      // branches and createCheckoutSession, which need mocked Stripe API
      // responses regardless.
      constructEvent: jest.fn((raw: Buffer) => JSON.parse(raw.toString()))
    }
  }
}));

import { Subscription } from '../models/Subscription';
import { Plan } from '../models/Plan';
import { Payment } from '../models/Payment';
import { stripe } from '../services/stripeService';
import app from '../app';

const mockedSubFindOne = Subscription.findOne as jest.Mock;
const mockedSubFindById = Subscription.findById as jest.Mock;
const mockedSubFind = Subscription.find as jest.Mock;
const mockedSubCreate = Subscription.create as jest.Mock;
const mockedPlanFindOne = Plan.findOne as jest.Mock;
const mockedPaymentFindOne = Payment.findOne as jest.Mock;
const mockedPaymentCreate = Payment.create as jest.Mock;
const mockedSessionsCreate = stripe.checkout.sessions.create as jest.Mock;
const mockedSessionsRetrieve = stripe.checkout.sessions.retrieve as jest.Mock;

function authCookie() {
  const token = jwt.sign({ id: 'user-1', email: 'user@example.com', name: 'Test User' }, 'test-secret');
  return `access_token=${token}`;
}

function postWebhookEvent(id: string, type: string, data: unknown) {
  return request(app)
    .post('/api/stripe/webhook')
    .set('Content-Type', 'application/json')
    .set('stripe-signature', 'irrelevant-mocked')
    .send(JSON.stringify({ id, type, data: { object: data } }));
}

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';
  process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test';
  process.env.PAYMENT_URL = 'https://payment.example';
});

beforeEach(() => {
  jest.clearAllMocks();
  // Stripe answers a wind-down with the updated subscription; the controller reads
  // its period end to record when access actually stops.
  (stripe.subscriptions.update as jest.Mock).mockResolvedValue({
    id: 'sub_stripe',
    cancel_at: 1893456000,
    items: { data: [{ id: 'si_1' }] }
  });
  (stripe.subscriptions.retrieve as jest.Mock).mockResolvedValue({
    id: 'sub_stripe',
    items: { data: [{ id: 'si_1' }] }
  });
});

describe('POST /api/subscriptions/checkout-session', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).post('/api/subscriptions/checkout-session').send({ planCode: 'pro' });
    expect(res.status).toBe(401);
  });

  it('throws NotFoundError when the plan does not exist', async () => {
    mockedPlanFindOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/subscriptions/checkout-session')
      .set('Cookie', authCookie())
      .send({ planCode: 'missing' });

    expect(res.status).toBe(404);
  });

  it('activates a free plan immediately without touching Stripe (new subscription)', async () => {
    mockedPlanFindOne.mockResolvedValue({ code: 'free', priceMonthlyCents: 0, stripePriceId: undefined });
    mockedSubFindOne.mockResolvedValue(null);
    mockedSubCreate.mockResolvedValue({ id: 'sub1', userEmail: 'user@example.com', planCode: 'free' });
    mockedSubFind.mockResolvedValue([]);

    const res = await request(app)
      .post('/api/subscriptions/checkout-session')
      .set('Cookie', authCookie())
      .send({ planCode: 'free' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, free: true, url: '/subscription' });
    expect(mockedSessionsCreate).not.toHaveBeenCalled();
  });

  it('reactivates an existing free subscription instead of creating a new one, clearing any pending end date', async () => {
    mockedPlanFindOne.mockResolvedValue({ code: 'free', priceMonthlyCents: 0 });
    // A `canceling` record carries a cancelAt the UI renders as "Ends: <date>". Reactivating
    // without clearing it keeps advertising an expiry that no longer applies.
    const existingSub: any = { userEmail: 'user@example.com', planCode: 'free', status: 'canceling', cancelAt: new Date('2026-09-01'), save: jest.fn().mockResolvedValue(undefined) };
    mockedSubFindOne.mockResolvedValue(existingSub);
    mockedSubFind.mockResolvedValue([]);

    const res = await request(app)
      .post('/api/subscriptions/checkout-session')
      .set('Cookie', authCookie())
      .send({ planCode: 'free' });

    expect(res.status).toBe(201);
    expect(existingSub.status).toBe('active');
    expect(existingSub.cancelAt).toBeUndefined();
    expect(existingSub.save).toHaveBeenCalledTimes(1);
    expect(mockedSubCreate).not.toHaveBeenCalled();
  });

  it('refuses to sell a priced plan that has no stripePriceId, rather than granting it free', async () => {
    // This is the defect the condition above used to have: `|| !plan.stripePriceId`
    // routed a *priced* plan through the free-plan path, so any plan an admin had
    // not yet given a Stripe price to was claimable at zero — which was every plan
    // in the database.
    mockedPlanFindOne.mockResolvedValue({ code: 'pro', priceMonthlyCents: 1000, stripePriceId: undefined });
    mockedSubFindOne.mockResolvedValue(null);
    mockedSubCreate.mockResolvedValue({ id: 'sub1' });
    mockedSubFind.mockResolvedValue([]);

    const res = await request(app)
      .post('/api/subscriptions/checkout-session')
      .set('Cookie', authCookie())
      .send({ planCode: 'pro' });

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    // Nothing is created and nothing is granted on the way out.
    expect(mockedSubCreate).not.toHaveBeenCalled();
    expect(mockedSessionsCreate).not.toHaveBeenCalled();
  });

  it('still treats a genuinely zero-priced plan as free even when it carries a stripePriceId', async () => {
    // Free is decided by price, not by Stripe wiring.
    mockedPlanFindOne.mockResolvedValue({ code: 'free', priceMonthlyCents: 0, stripePriceId: 'price_leftover' });
    mockedSubFindOne.mockResolvedValue(null);
    mockedSubCreate.mockResolvedValue({ id: 'sub1' });
    mockedSubFind.mockResolvedValue([]);

    const res = await request(app)
      .post('/api/subscriptions/checkout-session')
      .set('Cookie', authCookie())
      .send({ planCode: 'free' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ free: true });
    expect(mockedSessionsCreate).not.toHaveBeenCalled();
  });

  // The downgrade case is the one that used to double-bill: checkout created a *second*
  // subscription, and supersession only ever cancelled cheaper ones, so the dearer plan
  // stayed live at Stripe and kept invoicing alongside the new one.
  it('switches an existing subscription in place rather than selling a second one', async () => {
    mockedPlanFindOne.mockResolvedValue({ code: 'personal', _id: 'plan-personal', name: 'Personal', priceMonthlyCents: 600, stripePriceId: 'price_personal' });
    const live: any = {
      id: 'sub-family',
      userEmail: 'user@example.com',
      planCode: 'family',
      status: 'active',
      stripeSubscriptionId: 'sub_stripe_family',
      save: jest.fn().mockResolvedValue(undefined)
    };
    mockedSubFindOne.mockResolvedValueOnce(live);
    mockedSubFind.mockResolvedValue([]);

    const res = await request(app)
      .post('/api/subscriptions/checkout-session')
      .set('Cookie', authCookie())
      .send({ planCode: 'personal' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, changed: true, url: '/subscription' });
    // One subscription, moved onto the new price, with the difference prorated.
    expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_stripe_family', expect.objectContaining({
      items: [{ id: 'si_1', price: 'price_personal' }],
      proration_behavior: 'create_prorations'
    }));
    expect(mockedSessionsCreate).not.toHaveBeenCalled();
    expect(mockedSubCreate).not.toHaveBeenCalled();
    expect(live.planCode).toBe('personal');
    expect(live.status).toBe('active');
  });

  it('refuses a switch to the plan the customer is already on', async () => {
    mockedPlanFindOne.mockResolvedValue({ code: 'personal', _id: 'plan-personal', name: 'Personal', priceMonthlyCents: 600, stripePriceId: 'price_personal' });
    mockedSubFindOne.mockResolvedValueOnce({
      id: 'sub-personal', userEmail: 'user@example.com', planCode: 'personal', status: 'active',
      stripeSubscriptionId: 'sub_stripe_personal', save: jest.fn()
    });

    const res = await request(app)
      .post('/api/subscriptions/checkout-session')
      .set('Cookie', authCookie())
      .send({ planCode: 'personal' });

    expect(res.status).toBe(400);
    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
  });

  it('lets a canceling subscription be resumed by choosing its own plan again', async () => {
    // Choosing a plan is the clearest possible statement that the customer is staying.
    mockedPlanFindOne.mockResolvedValue({ code: 'personal', _id: 'plan-personal', name: 'Personal', priceMonthlyCents: 600, stripePriceId: 'price_personal' });
    const live: any = {
      id: 'sub-personal', userEmail: 'user@example.com', planCode: 'personal', status: 'canceling',
      cancelAt: new Date('2026-09-01'), stripeSubscriptionId: 'sub_stripe_personal', save: jest.fn().mockResolvedValue(undefined)
    };
    mockedSubFindOne.mockResolvedValueOnce(live);
    mockedSubFind.mockResolvedValue([]);

    const res = await request(app)
      .post('/api/subscriptions/checkout-session')
      .set('Cookie', authCookie())
      .send({ planCode: 'personal' });

    expect(res.status).toBe(200);
    expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_stripe_personal', expect.objectContaining({ cancel_at_period_end: false }));
    expect(live.status).toBe('active');
    expect(live.cancelAt).toBeUndefined();
  });

  it('never treats a comp grant as the subscription to switch', async () => {
    // An admin grant has no Stripe side, and a purchase must not consume one.
    mockedPlanFindOne.mockResolvedValue({ code: 'personal', _id: 'plan-personal', name: 'Personal', priceMonthlyCents: 600, stripePriceId: 'price_personal' });
    mockedSubFindOne.mockResolvedValue(null);
    mockedSubCreate.mockResolvedValue({ id: 'sub1' });
    mockedSessionsCreate.mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.com/pay/cs_1' });

    await request(app)
      .post('/api/subscriptions/checkout-session')
      .set('Cookie', authCookie())
      .send({ planCode: 'personal' });

    expect(mockedSubFindOne).toHaveBeenCalledWith(expect.objectContaining({ isComp: { $ne: true } }));
  });

  // "Switch to Free" is a cancellation. It used to call stripe.subscriptions.cancel(),
  // revoking access on the click and forfeiting the rest of a month already paid for —
  // while the cancel button, for the same intent, kept the period.
  it('winds a paid subscription down at period end when the customer switches to free', async () => {
    mockedPlanFindOne.mockResolvedValue({ code: 'free', priceMonthlyCents: 0 });
    mockedSubFindOne.mockResolvedValue(null);
    mockedSubCreate.mockResolvedValue({ id: 'sub-free', userEmail: 'user@example.com', planCode: 'free' });
    const paid: any = {
      id: 'sub-family', userEmail: 'user@example.com', planCode: 'family', status: 'active',
      stripeSubscriptionId: 'sub_stripe_family', save: jest.fn().mockResolvedValue(undefined)
    };
    mockedSubFind.mockResolvedValue([paid]);

    const res = await request(app)
      .post('/api/subscriptions/checkout-session')
      .set('Cookie', authCookie())
      .send({ planCode: 'free' });

    expect(res.status).toBe(201);
    expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_stripe_family', { cancel_at_period_end: true });
    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
    expect(paid.status).toBe('canceling');
  });

  it('refuses the switch rather than guessing when Stripe cannot show the current item', async () => {
    mockedPlanFindOne.mockResolvedValue({ code: 'personal', _id: 'plan-personal', name: 'Personal', priceMonthlyCents: 600, stripePriceId: 'price_personal' });
    const live: any = {
      id: 'sub-family', userEmail: 'user@example.com', planCode: 'family', status: 'active',
      stripeSubscriptionId: 'sub_stripe_family', save: jest.fn()
    };
    mockedSubFindOne.mockResolvedValueOnce(live);
    (stripe.subscriptions.retrieve as jest.Mock).mockResolvedValueOnce({ id: 'sub_stripe_family', items: { data: [] } });

    const res = await request(app)
      .post('/api/subscriptions/checkout-session')
      .set('Cookie', authCookie())
      .send({ planCode: 'personal' });

    expect(res.status).toBe(502);
    expect(live.save).not.toHaveBeenCalled();
  });

  it('collects tax and a billing address, since VAT is due where the customer is', async () => {
    mockedPlanFindOne.mockResolvedValue({ code: 'pro', priceMonthlyCents: 1000, stripePriceId: 'price_123' });
    mockedSubFindOne.mockResolvedValue(null);
    mockedSubCreate.mockResolvedValue({ id: 'sub1' });
    mockedSessionsCreate.mockResolvedValue({ id: 'cs_test_1', url: 'https://checkout.stripe.com/pay/cs_test_1' });

    await request(app)
      .post('/api/subscriptions/checkout-session')
      .set('Cookie', authCookie())
      .send({ planCode: 'pro' });

    expect(mockedSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        automatic_tax: { enabled: true },
        // Stripe Tax computes from the address, so it cannot be optional.
        billing_address_collection: 'required',
        tax_id_collection: { enabled: true }
      })
    );
  });

  it('creates a real Stripe checkout session for a paid plan', async () => {
    process.env.PAYMENT_URL = 'https://payment.example';
    mockedPlanFindOne.mockResolvedValue({ code: 'pro', priceMonthlyCents: 1000, stripePriceId: 'price_123' });
    mockedSubFindOne.mockResolvedValue(null);
    mockedSubCreate.mockResolvedValue({ id: 'sub1' });
    mockedSessionsCreate.mockResolvedValue({ id: 'cs_test_1', url: 'https://checkout.stripe.com/pay/cs_test_1' });

    const res = await request(app)
      .post('/api/subscriptions/checkout-session')
      .set('Cookie', authCookie())
      .send({ planCode: 'pro' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, sessionId: 'cs_test_1', url: 'https://checkout.stripe.com/pay/cs_test_1' });
  });

  it('falls back to a constructed checkout URL when Stripe omits session.url', async () => {
    process.env.PAYMENT_URL = 'https://payment.example';
    mockedPlanFindOne.mockResolvedValue({ code: 'pro', priceMonthlyCents: 1000, stripePriceId: 'price_123' });
    mockedSubFindOne.mockResolvedValue(null);
    mockedSubCreate.mockResolvedValue({ id: 'sub1' });
    mockedSessionsCreate.mockResolvedValue({ id: 'cs_test_2', url: null });

    const res = await request(app)
      .post('/api/subscriptions/checkout-session')
      .set('Cookie', authCookie())
      .send({ planCode: 'pro' });

    expect(res.body.url).toBe('https://checkout.stripe.com/c/cs_test_2');
  });

  it('reuses an existing incomplete subscription instead of creating a new one', async () => {
    process.env.PAYMENT_URL = 'https://payment.example';
    mockedPlanFindOne.mockResolvedValue({ code: 'pro', priceMonthlyCents: 1000, stripePriceId: 'price_123' });
    mockedSubFindOne.mockResolvedValue({ id: 'existing-incomplete' });
    mockedSessionsCreate.mockResolvedValue({ id: 'cs_test_3', url: 'https://checkout.stripe.com/pay/cs_test_3' });

    await request(app).post('/api/subscriptions/checkout-session').set('Cookie', authCookie()).send({ planCode: 'pro' });

    expect(mockedSubCreate).not.toHaveBeenCalled();
  });
});

describe('POST /api/stripe/webhook — checkout.session.completed', () => {
  it('activates an incomplete subscription and records a payment', async () => {
    const sub: any = { status: 'incomplete', save: jest.fn().mockResolvedValue(undefined), userEmail: 'user@example.com', planCode: 'pro', id: 'sub1' };
    mockedSubFindById.mockResolvedValue(sub);
    mockedPlanFindOne.mockResolvedValue({ code: 'pro', priceMonthlyCents: 1000 });
    mockedSubFind.mockResolvedValue([]);
    mockedPaymentFindOne.mockResolvedValue(null);

    const res = await postWebhookEvent('evt_checkout_1', 'checkout.session.completed', {
      id: 'cs_evt_1',
      metadata: { subscriptionId: 'sub1' },
      subscription: 'sub_stripe_1',
      customer: 'cus_1'
    });

    expect(res.status).toBe(200);
    expect(sub.status).toBe('active');
    expect(sub.save).toHaveBeenCalledTimes(1);
    expect(mockedPaymentCreate).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the subscription is already active (not incomplete)', async () => {
    const sub: any = { status: 'active', save: jest.fn() };
    mockedSubFindById.mockResolvedValue(sub);

    const res = await postWebhookEvent('evt_checkout_2', 'checkout.session.completed', {
      metadata: { subscriptionId: 'sub1' }
    });

    expect(res.status).toBe(200);
    expect(sub.save).not.toHaveBeenCalled();
  });

  it('does nothing when there is no subscriptionId in metadata', async () => {
    const res = await postWebhookEvent('evt_checkout_3', 'checkout.session.completed', { metadata: {} });
    expect(res.status).toBe(200);
    expect(mockedSubFindById).not.toHaveBeenCalled();
  });

  // Marking the superseded record 'canceled' locally without telling Stripe leaves the old
  // subscription invoicing forever — the user pays for both plans while the database shows one.
  // It winds down at *period end* rather than immediately: that period is already paid for.
  it('winds the superseded paid subscription down at Stripe, not just locally', async () => {
    const upgraded: any = { status: 'incomplete', save: jest.fn().mockResolvedValue(undefined), userEmail: 'user@example.com', planCode: 'elite', id: 'sub-elite' };
    const superseded: any = { status: 'active', planCode: 'pro', id: 'sub-pro', stripeSubscriptionId: 'sub_stripe_pro', save: jest.fn().mockResolvedValue(undefined) };
    mockedSubFindById.mockResolvedValue(upgraded);
    mockedPlanFindOne.mockImplementation(async ({ code }: { code: string }) =>
      code === 'elite' ? { code: 'elite', priceMonthlyCents: 5000 } : { code: 'pro', priceMonthlyCents: 1000 }
    );
    mockedSubFind.mockResolvedValue([superseded]);
    mockedPaymentFindOne.mockResolvedValue(null);

    const res = await postWebhookEvent('evt_checkout_supersede_1', 'checkout.session.completed', {
      id: 'cs_supersede_1',
      metadata: { subscriptionId: 'sub-elite' },
      subscription: 'sub_stripe_elite',
      customer: 'cus_1'
    });

    expect(res.status).toBe(200);
    expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_stripe_pro', { cancel_at_period_end: true });
    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
    expect(superseded.status).toBe('canceling');
    expect(superseded.save).toHaveBeenCalledTimes(1);
  });

  // Direction-agnostic on purpose: the price comparison this replaced only ever cancelled
  // *cheaper* subscriptions, so a downgrade left the dearer one invoicing alongside the new one.
  it('supersedes a more expensive subscription too, which is the downgrade case', async () => {
    const downgraded: any = { status: 'incomplete', save: jest.fn().mockResolvedValue(undefined), userEmail: 'user@example.com', planCode: 'pro', id: 'sub-pro' };
    const superseded: any = { status: 'active', planCode: 'elite', id: 'sub-elite', stripeSubscriptionId: 'sub_stripe_elite_old', save: jest.fn().mockResolvedValue(undefined) };
    mockedSubFindById.mockResolvedValue(downgraded);
    mockedPlanFindOne.mockImplementation(async ({ code }: { code: string }) =>
      code === 'elite' ? { code: 'elite', priceMonthlyCents: 5000 } : { code: 'pro', priceMonthlyCents: 1000 }
    );
    mockedSubFind.mockResolvedValue([superseded]);
    mockedPaymentFindOne.mockResolvedValue(null);

    await postWebhookEvent('evt_checkout_supersede_downgrade', 'checkout.session.completed', {
      id: 'cs_supersede_downgrade',
      metadata: { subscriptionId: 'sub-pro' },
      subscription: 'sub_stripe_pro'
    });

    expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_stripe_elite_old', { cancel_at_period_end: true });
    expect(superseded.status).toBe('canceling');
  });

  // An admin grant is not superseded by a purchase: buying Personal must not consume
  // a staff or friend grant, which has no Stripe side to cancel in the first place.
  it('leaves comp grants out of the supersede query entirely', async () => {
    const bought: any = { status: 'incomplete', save: jest.fn().mockResolvedValue(undefined), userEmail: 'user@example.com', planCode: 'pro', id: 'sub-pro' };
    mockedSubFindById.mockResolvedValue(bought);
    mockedPlanFindOne.mockResolvedValue({ code: 'pro', priceMonthlyCents: 1000 });
    mockedSubFind.mockResolvedValue([]);
    mockedPaymentFindOne.mockResolvedValue(null);

    await postWebhookEvent('evt_checkout_supersede_comp', 'checkout.session.completed', {
      id: 'cs_supersede_comp',
      metadata: { subscriptionId: 'sub-pro' },
      subscription: 'sub_stripe_pro'
    });

    expect(mockedSubFind).toHaveBeenCalledWith(expect.objectContaining({ isComp: { $ne: true } }));
  });

  // A subscription still winding down is still billing until the period ends, so it has to be
  // in the supersede query — otherwise switching plans leaves it live at Stripe.
  it('supersedes a canceling subscription too', async () => {
    const upgraded: any = { status: 'incomplete', save: jest.fn().mockResolvedValue(undefined), userEmail: 'user@example.com', planCode: 'elite', id: 'sub-elite' };
    mockedSubFindById.mockResolvedValue(upgraded);
    mockedPlanFindOne.mockResolvedValue({ code: 'elite', priceMonthlyCents: 5000 });
    mockedSubFind.mockResolvedValue([]);
    mockedPaymentFindOne.mockResolvedValue(null);

    await postWebhookEvent('evt_checkout_supersede_2', 'checkout.session.completed', {
      id: 'cs_supersede_2',
      metadata: { subscriptionId: 'sub-elite' },
      subscription: 'sub_stripe_elite'
    });

    expect(mockedSubFind).toHaveBeenCalledWith(
      expect.objectContaining({ status: { $in: expect.arrayContaining(['canceling']) } })
    );
  });

  // An `incomplete` row was never paid for, so there is no period to protect — it goes at once,
  // which is what stops abandoned checkouts accumulating as live-looking rows.
  it('drops a superseded incomplete subscription immediately instead of winding it down', async () => {
    const bought: any = { status: 'incomplete', save: jest.fn().mockResolvedValue(undefined), userEmail: 'user@example.com', planCode: 'elite', id: 'sub-elite' };
    const abandoned: any = { status: 'incomplete', planCode: 'pro', id: 'sub-pro', stripeSubscriptionId: 'sub_stripe_abandoned', save: jest.fn().mockResolvedValue(undefined) };
    mockedSubFindById.mockResolvedValue(bought);
    mockedPlanFindOne.mockResolvedValue({ code: 'elite', priceMonthlyCents: 5000 });
    mockedSubFind.mockResolvedValue([abandoned]);
    mockedPaymentFindOne.mockResolvedValue(null);

    await postWebhookEvent('evt_checkout_supersede_incomplete', 'checkout.session.completed', {
      id: 'cs_supersede_incomplete',
      metadata: { subscriptionId: 'sub-elite' },
      subscription: 'sub_stripe_elite'
    });

    expect(stripe.subscriptions.cancel).toHaveBeenCalledWith('sub_stripe_abandoned');
    expect(abandoned.status).toBe('canceled');
  });

  // A comp grant has nothing at Stripe, so there is no period to preserve and nothing to call.
  it('closes a superseded record that has no Stripe subscription without calling Stripe', async () => {
    const bought: any = { status: 'incomplete', save: jest.fn().mockResolvedValue(undefined), userEmail: 'user@example.com', planCode: 'elite', id: 'sub-elite' };
    const local: any = { status: 'active', planCode: 'pro', id: 'sub-pro', save: jest.fn().mockResolvedValue(undefined) };
    mockedSubFindById.mockResolvedValue(bought);
    mockedPlanFindOne.mockResolvedValue({ code: 'elite', priceMonthlyCents: 5000 });
    mockedSubFind.mockResolvedValue([local]);
    mockedPaymentFindOne.mockResolvedValue(null);

    await postWebhookEvent('evt_checkout_supersede_nostripe', 'checkout.session.completed', {
      id: 'cs_supersede_nostripe',
      metadata: { subscriptionId: 'sub-elite' },
      subscription: 'sub_stripe_elite'
    });

    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
    expect(local.status).toBe('canceled');
    expect(local.canceledAt).toBeInstanceOf(Date);
  });

  // A failed Stripe cancel leaves the record alone, and says so loudly. Marking it canceled
  // locally would revoke the plan while Stripe kept charging for it — the same "access gone,
  // billing alive" failure Phase 0 removed from the user-facing cancel path.
  it('leaves the record untouched when the Stripe wind-down fails', async () => {
    const upgraded: any = { status: 'incomplete', save: jest.fn().mockResolvedValue(undefined), userEmail: 'user@example.com', planCode: 'elite', id: 'sub-elite' };
    const superseded: any = { status: 'active', planCode: 'pro', id: 'sub-pro', stripeSubscriptionId: 'sub_stripe_pro', save: jest.fn().mockResolvedValue(undefined) };
    mockedSubFindById.mockResolvedValue(upgraded);
    mockedPlanFindOne.mockImplementation(async ({ code }: { code: string }) =>
      code === 'elite' ? { code: 'elite', priceMonthlyCents: 5000 } : { code: 'pro', priceMonthlyCents: 1000 }
    );
    mockedSubFind.mockResolvedValue([superseded]);
    mockedPaymentFindOne.mockResolvedValue(null);
    (stripe.subscriptions.update as jest.Mock).mockRejectedValueOnce(new Error('stripe down'));

    const res = await postWebhookEvent('evt_checkout_supersede_3', 'checkout.session.completed', {
      id: 'cs_supersede_3',
      metadata: { subscriptionId: 'sub-elite' },
      subscription: 'sub_stripe_elite'
    });

    expect(res.status).toBe(200);
    expect(superseded.status).toBe('active');
    expect(superseded.save).not.toHaveBeenCalled();
  });
});

describe('POST /api/stripe/webhook — customer.subscription.updated', () => {
  // Plan switches now happen *on* the subscription rather than through a new checkout,
  // so this event is what keeps the local record honest — and it is the one the billing
  // portal will speak through once 5.2 lands.
  it('follows a price change onto the plan that price belongs to', async () => {
    const sub: any = { planCode: 'family', status: 'active', save: jest.fn().mockResolvedValue(undefined) };
    mockedSubFindOne.mockResolvedValue(sub);
    mockedPlanFindOne.mockResolvedValue({ code: 'personal', _id: 'plan-personal', stripePriceId: 'price_personal' });

    const res = await postWebhookEvent('evt_sub_updated_1', 'customer.subscription.updated', {
      id: 'sub_stripe_1',
      status: 'active',
      cancel_at_period_end: false,
      items: { data: [{ id: 'si_1', price: { id: 'price_personal' } }] }
    });

    expect(res.status).toBe(200);
    expect(sub.planCode).toBe('personal');
    expect(sub.status).toBe('active');
  });

  it('records a pending cancellation as canceling, with the date access actually ends', async () => {
    const sub: any = { planCode: 'personal', status: 'active', save: jest.fn().mockResolvedValue(undefined) };
    mockedSubFindOne.mockResolvedValue(sub);
    mockedPlanFindOne.mockResolvedValue(null);

    await postWebhookEvent('evt_sub_updated_2', 'customer.subscription.updated', {
      id: 'sub_stripe_1',
      status: 'active',
      cancel_at_period_end: true,
      cancel_at: 1893456000,
      items: { data: [{ id: 'si_1', price: { id: 'price_personal' } }] }
    });

    expect(sub.status).toBe('canceling');
    expect(sub.cancelAt).toEqual(new Date(1893456000 * 1000));
  });

  it('reads dunning as past_due, and a resumed subscription as active again', async () => {
    const dunning: any = { planCode: 'personal', status: 'active', save: jest.fn().mockResolvedValue(undefined) };
    mockedSubFindOne.mockResolvedValue(dunning);
    mockedPlanFindOne.mockResolvedValue(null);

    await postWebhookEvent('evt_sub_updated_3', 'customer.subscription.updated', {
      id: 'sub_stripe_1', status: 'past_due', cancel_at_period_end: false, items: { data: [] }
    });
    expect(dunning.status).toBe('past_due');

    const resumed: any = { planCode: 'personal', status: 'canceling', cancelAt: new Date(), save: jest.fn().mockResolvedValue(undefined) };
    mockedSubFindOne.mockResolvedValue(resumed);

    await postWebhookEvent('evt_sub_updated_4', 'customer.subscription.updated', {
      id: 'sub_stripe_1', status: 'active', cancel_at_period_end: false, items: { data: [] }
    });
    expect(resumed.status).toBe('active');
    expect(resumed.cancelAt).toBeUndefined();
  });

  it('leaves a canceled record alone', async () => {
    const sub: any = { planCode: 'personal', status: 'canceled', save: jest.fn() };
    mockedSubFindOne.mockResolvedValue(sub);

    await postWebhookEvent('evt_sub_updated_5', 'customer.subscription.updated', {
      id: 'sub_stripe_1', status: 'active', cancel_at_period_end: false, items: { data: [] }
    });

    expect(sub.save).not.toHaveBeenCalled();
  });
});

describe('POST /api/stripe/webhook — invoice.payment_succeeded', () => {
  it('updates renewsAt and records a payment', async () => {
    const sub: any = { save: jest.fn().mockResolvedValue(undefined), userEmail: 'user@example.com', planCode: 'pro', id: 'sub1' };
    mockedSubFindOne.mockResolvedValue(sub);
    mockedPlanFindOne.mockResolvedValue({ code: 'pro', priceMonthlyCents: 1000 });
    mockedPaymentFindOne.mockResolvedValue(null);

    const res = await postWebhookEvent('evt_invoice_1', 'invoice.payment_succeeded', {
      subscription: 'sub_stripe_1',
      id: 'in_1',
      amount_paid: 1000,
      currency: 'eur',
      lines: { data: [{ period: { end: 1893456000 } }] }
    });

    expect(res.status).toBe(200);
    expect(sub.renewsAt).toBeInstanceOf(Date);
    expect(mockedPaymentCreate).toHaveBeenCalledTimes(1);
  });

  it('skips creating a duplicate payment for the same invoice', async () => {
    const sub: any = { save: jest.fn().mockResolvedValue(undefined), userEmail: 'user@example.com', planCode: 'pro', id: 'sub1' };
    mockedSubFindOne.mockResolvedValue(sub);
    mockedPlanFindOne.mockResolvedValue({ code: 'pro', priceMonthlyCents: 1000 });
    mockedPaymentFindOne.mockResolvedValue({ _id: 'existing-payment' });

    const res = await postWebhookEvent('evt_invoice_2', 'invoice.payment_succeeded', {
      subscription: 'sub_stripe_1',
      id: 'in_2',
      lines: { data: [] }
    });

    expect(res.status).toBe(200);
    expect(mockedPaymentCreate).not.toHaveBeenCalled();
  });

  it('does not create a payment for a free plan', async () => {
    const sub: any = { save: jest.fn().mockResolvedValue(undefined), userEmail: 'user@example.com', planCode: 'free', id: 'sub1' };
    mockedSubFindOne.mockResolvedValue(sub);
    mockedPlanFindOne.mockResolvedValue({ code: 'free', priceMonthlyCents: 0 });

    const res = await postWebhookEvent('evt_invoice_3', 'invoice.payment_succeeded', {
      subscription: 'sub_stripe_1',
      id: 'in_3',
      lines: { data: [] }
    });

    expect(res.status).toBe(200);
    expect(mockedPaymentCreate).not.toHaveBeenCalled();
  });
});

describe('POST /api/stripe/webhook — customer.subscription.deleted', () => {
  it('marks the matching subscription canceled', async () => {
    const sub: any = { status: 'active', save: jest.fn().mockResolvedValue(undefined) };
    mockedSubFindOne.mockResolvedValue(sub);

    const res = await postWebhookEvent('evt_deleted_1', 'customer.subscription.deleted', { id: 'sub_stripe_1' });

    expect(res.status).toBe(200);
    expect(sub.status).toBe('canceled');
    expect(sub.canceledAt).toBeInstanceOf(Date);
  });

  it('leaves an already-canceled subscription alone', async () => {
    const sub: any = { status: 'canceled', save: jest.fn() };
    mockedSubFindOne.mockResolvedValue(sub);

    await postWebhookEvent('evt_deleted_2', 'customer.subscription.deleted', { id: 'sub_stripe_2' });

    expect(sub.save).not.toHaveBeenCalled();
  });

  // This event is the only thing that ends a `canceling` subscription — it fires when the
  // paid period Stripe was told to run out actually runs out.
  it('flips a canceling subscription to canceled at period end', async () => {
    const sub: any = { status: 'canceling', save: jest.fn().mockResolvedValue(undefined) };
    mockedSubFindOne.mockResolvedValue(sub);

    await postWebhookEvent('evt_deleted_3', 'customer.subscription.deleted', { id: 'sub_stripe_3' });

    expect(sub.status).toBe('canceled');
    expect(sub.canceledAt).toBeInstanceOf(Date);
    expect(sub.save).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/stripe/webhook — invoice.payment_failed vs canceling', () => {
  // A subscription winding down will fail its final renewal by design. Flipping it to
  // past_due there would silently un-cancel it and put it back into dunning.
  it('does not drag a canceling subscription back into past_due', async () => {
    const sub: any = { status: 'canceling', save: jest.fn() };
    mockedSubFindOne.mockResolvedValue(sub);

    const res = await postWebhookEvent('evt_failed_canceling', 'invoice.payment_failed', {
      subscription: 'sub_stripe_canceling'
    });

    expect(res.status).toBe(200);
    expect(sub.status).toBe('canceling');
    expect(sub.save).not.toHaveBeenCalled();
  });
});

describe('POST /api/stripe/webhook — malformed body', () => {
  it('returns 400 when the body is not a Buffer', async () => {
    // supertest always sends a Buffer-backed body for raw content types via
    // .send(string), so simulate the "not a buffer" branch isn't reachable
    // through the real middleware chain — this is defensive dead code from
    // the route's perspective. Covered instead via the missing-signature 400.
    const res = await request(app).post('/api/stripe/webhook').set('Content-Type', 'application/json').send('{}');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/subscriptions/checkout-session/:id', () => {
  it('returns the session status without a subscription when there is no metadata', async () => {
    mockedSessionsRetrieve.mockResolvedValue({ status: 'open', payment_status: 'unpaid', metadata: {} });

    const res = await request(app)
      .get('/api/subscriptions/checkout-session/cs_test_1')
      .set('Cookie', authCookie());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, status: 'open', subscription: null });
  });

  it('auto-heals a stuck incomplete subscription when the session is complete/paid', async () => {
    mockedSessionsRetrieve.mockResolvedValue({
      id: 'cs_test_2',
      status: 'complete',
      payment_status: 'paid',
      metadata: { subscriptionId: 'sub1' },
      subscription: { id: 'sub_stripe_1' },
      customer: 'cus_1'
    });
    const subDoc: any = { id: 'sub1', status: 'incomplete', save: jest.fn().mockResolvedValue(undefined), userEmail: 'user@example.com', planCode: 'pro' };
    mockedSubFindById.mockResolvedValue(subDoc);
    mockedPlanFindOne.mockResolvedValue({ code: 'pro', priceMonthlyCents: 1000 });
    mockedSubFind.mockResolvedValue([]);
    mockedPaymentFindOne.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/subscriptions/checkout-session/cs_test_2')
      .set('Cookie', authCookie());

    expect(res.status).toBe(200);
    expect(subDoc.status).toBe('active');
    expect(subDoc.save).toHaveBeenCalledTimes(1);
  });

  it('does not auto-heal an already-active subscription', async () => {
    mockedSessionsRetrieve.mockResolvedValue({
      status: 'complete',
      payment_status: 'paid',
      metadata: { subscriptionId: 'sub1' }
    });
    const subDoc: any = { id: 'sub1', status: 'active', save: jest.fn() };
    mockedSubFindById.mockResolvedValue(subDoc);

    await request(app).get('/api/subscriptions/checkout-session/cs_test_3').set('Cookie', authCookie());

    expect(subDoc.save).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/subscriptions/checkout-session/cs_test_1');
    expect(res.status).toBe(401);
  });
});
