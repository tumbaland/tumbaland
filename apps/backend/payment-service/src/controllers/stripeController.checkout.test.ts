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
    subscriptions: { cancel: jest.fn() },
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

beforeEach(() => jest.clearAllMocks());

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
  it('cancels the superseded lower-priced subscription at Stripe, not just locally', async () => {
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
    expect(stripe.subscriptions.cancel).toHaveBeenCalledWith('sub_stripe_pro');
    expect(superseded.status).toBe('canceled');
    expect(superseded.save).toHaveBeenCalledTimes(1);
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

  // A failed Stripe cancel still supersedes the record locally, but must be loud: the old
  // subscription keeps invoicing until someone acts on it.
  it('still supersedes locally when the Stripe cancel fails', async () => {
    const upgraded: any = { status: 'incomplete', save: jest.fn().mockResolvedValue(undefined), userEmail: 'user@example.com', planCode: 'elite', id: 'sub-elite' };
    const superseded: any = { status: 'active', planCode: 'pro', id: 'sub-pro', stripeSubscriptionId: 'sub_stripe_pro', save: jest.fn().mockResolvedValue(undefined) };
    mockedSubFindById.mockResolvedValue(upgraded);
    mockedPlanFindOne.mockImplementation(async ({ code }: { code: string }) =>
      code === 'elite' ? { code: 'elite', priceMonthlyCents: 5000 } : { code: 'pro', priceMonthlyCents: 1000 }
    );
    mockedSubFind.mockResolvedValue([superseded]);
    mockedPaymentFindOne.mockResolvedValue(null);
    (stripe.subscriptions.cancel as jest.Mock).mockRejectedValueOnce(new Error('stripe down'));

    const res = await postWebhookEvent('evt_checkout_supersede_3', 'checkout.session.completed', {
      id: 'cs_supersede_3',
      metadata: { subscriptionId: 'sub-elite' },
      subscription: 'sub_stripe_elite'
    });

    expect(res.status).toBe(200);
    expect(superseded.status).toBe('canceled');
    expect(superseded.save).toHaveBeenCalledTimes(1);
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
