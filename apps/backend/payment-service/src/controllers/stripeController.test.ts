import request from 'supertest';
import Stripe from 'stripe';

jest.mock('../models/Subscription', () => ({
  Subscription: {
    findOne: jest.fn(),
    findById: jest.fn(),
    find: jest.fn()
  }
}));
jest.mock('../models/Plan', () => ({
  Plan: {
    findOne: jest.fn()
  }
}));
jest.mock('../models/Payment', () => ({
  Payment: {
    findOne: jest.fn(),
    create: jest.fn()
  }
}));

import { Subscription } from '../models/Subscription';
import app from '../app';

const STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';

function signedRequest(payloadObj: Record<string, unknown>) {
  const payload = JSON.stringify(payloadObj);
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: STRIPE_WEBHOOK_SECRET });
  return { payload, header };
}

function postWebhook(payload: string, header: string) {
  return request(app)
    .post('/api/stripe/webhook')
    .set('Content-Type', 'application/json')
    .set('stripe-signature', header)
    .send(payload);
}

describe('POST /api/stripe/webhook (signed events)', () => {
  beforeAll(() => {
    process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';
    process.env.STRIPE_WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('processes invoice.payment_failed end-to-end and marks the subscription past_due', async () => {
    const sub = { status: 'active', save: jest.fn().mockResolvedValue(undefined) };
    (Subscription.findOne as jest.Mock).mockResolvedValue(sub);

    const { payload, header } = signedRequest({
      id: 'evt_test_payment_failed_1',
      type: 'invoice.payment_failed',
      data: { object: { subscription: 'sub_123' } }
    });

    const res = await postWebhook(payload, header);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(Subscription.findOne).toHaveBeenCalledWith({ stripeSubscriptionId: 'sub_123' });
    expect(sub.status).toBe('past_due');
    expect(sub.save).toHaveBeenCalledTimes(1);
  });

  it('leaves an already-canceled subscription alone on invoice.payment_failed', async () => {
    const sub = { status: 'canceled', save: jest.fn().mockResolvedValue(undefined) };
    (Subscription.findOne as jest.Mock).mockResolvedValue(sub);

    const { payload, header } = signedRequest({
      id: 'evt_test_payment_failed_2',
      type: 'invoice.payment_failed',
      data: { object: { subscription: 'sub_456' } }
    });

    const res = await postWebhook(payload, header);

    expect(res.status).toBe(200);
    expect(sub.status).toBe('canceled');
    expect(sub.save).not.toHaveBeenCalled();
  });

  it('accepts an unhandled/irrelevant event type without processing anything (200, no crash)', async () => {
    const { payload, header } = signedRequest({
      id: 'evt_test_unhandled_1',
      type: 'customer.updated',
      data: { object: {} }
    });

    const res = await postWebhook(payload, header);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(Subscription.findOne).not.toHaveBeenCalled();
    expect(Subscription.findById).not.toHaveBeenCalled();
  });

  it('is idempotent: replaying the same event id a second time is a no-op', async () => {
    const sub = { status: 'active', save: jest.fn().mockResolvedValue(undefined) };
    (Subscription.findOne as jest.Mock).mockResolvedValue(sub);

    const { payload, header } = signedRequest({
      id: 'evt_test_dup_1',
      type: 'invoice.payment_failed',
      data: { object: { subscription: 'sub_789' } }
    });

    const first = await postWebhook(payload, header);
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ received: true });

    const second = await postWebhook(payload, header);
    expect(second.status).toBe(200);
    expect(second.body).toEqual({ received: true, duplicate: true });

    // Only processed once despite two deliveries of the same event id.
    expect(sub.save).toHaveBeenCalledTimes(1);
  });
});
