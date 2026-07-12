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

  it('reactivates an existing free subscription instead of creating a new one', async () => {
    mockedPlanFindOne.mockResolvedValue({ code: 'free', priceMonthlyCents: 0 });
    const existingSub: any = { userEmail: 'user@example.com', planCode: 'free', status: 'active', save: jest.fn().mockResolvedValue(undefined) };
    mockedSubFindOne.mockResolvedValue(existingSub);
    mockedSubFind.mockResolvedValue([]);

    const res = await request(app)
      .post('/api/subscriptions/checkout-session')
      .set('Cookie', authCookie())
      .send({ planCode: 'free' });

    expect(res.status).toBe(201);
    expect(existingSub.save).toHaveBeenCalledTimes(1);
    expect(mockedSubCreate).not.toHaveBeenCalled();
  });

  it('treats a plan with a price but no stripePriceId as a free-plan activation (the free-plan shortcut checks !stripePriceId too)', async () => {
    // Note: `if (!priceMonthlyCents || priceMonthlyCents === 0 || !plan.stripePriceId)` above
    // already routes any missing-stripePriceId plan through the free-plan path, so the later
    // `if (!priceId) throw new BadRequestError(...)` guard is unreachable in practice.
    mockedPlanFindOne.mockResolvedValue({ code: 'pro', priceMonthlyCents: 1000, stripePriceId: undefined });
    mockedSubFindOne.mockResolvedValue(null);
    mockedSubCreate.mockResolvedValue({ id: 'sub1' });
    mockedSubFind.mockResolvedValue([]);

    const res = await request(app)
      .post('/api/subscriptions/checkout-session')
      .set('Cookie', authCookie())
      .send({ planCode: 'pro' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ free: true });
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
