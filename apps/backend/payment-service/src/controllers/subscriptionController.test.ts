import request from 'supertest';
import jwt from 'jsonwebtoken';

jest.mock('../models/Subscription', () => ({
  Subscription: {
    find: jest.fn(),
    findOne: jest.fn()
  }
}));

jest.mock('../services/stripeService', () => ({
  ensureStripe: jest.fn(),
  stripe: { subscriptions: { update: jest.fn() } }
}));

import { Subscription } from '../models/Subscription';
import { stripe } from '../services/stripeService';
import app from '../app';

const mockedFind = Subscription.find as unknown as jest.Mock;
const mockedFindOne = Subscription.findOne as unknown as jest.Mock;
const mockedStripeUpdate = stripe.subscriptions.update as unknown as jest.Mock;

function authCookie() {
  const token = jwt.sign({ id: 'user-1', email: 'user@example.com', name: 'Test User' }, 'test-secret');
  return `access_token=${token}`;
}

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/subscriptions/me', () => {
  it('rejects requests with no access token', async () => {
    const res = await request(app).get('/api/subscriptions/me');
    expect(res.status).toBe(401);
  });

  it('returns null when the user has no active subscription', async () => {
    mockedFind.mockReturnValue({ populate: jest.fn().mockResolvedValue([]) });

    const res = await request(app).get('/api/subscriptions/me').set('Cookie', authCookie());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, subscription: null });
  });

  it('picks the highest-priced active subscription when several are returned', async () => {
    const cheap = { status: 'active', plan: { priceMonthlyCents: 500 }, createdAt: new Date('2026-01-01') };
    const expensive = { status: 'active', plan: { priceMonthlyCents: 1500 }, createdAt: new Date('2026-01-01') };
    mockedFind.mockReturnValue({ populate: jest.fn().mockResolvedValue([cheap, expensive]) });

    const res = await request(app).get('/api/subscriptions/me').set('Cookie', authCookie());

    expect(res.status).toBe(200);
    expect(res.body.subscription.plan.priceMonthlyCents).toBe(1500);
    expect(mockedFind).toHaveBeenCalledWith({
      userEmail: 'user@example.com',
      status: { $in: ['active', 'past_due', 'canceling', 'incomplete'] }
    });
  });

  it('breaks a price tie by preferring the better status (active over past_due)', async () => {
    const pastDue = { status: 'past_due', plan: { priceMonthlyCents: 1000 }, createdAt: new Date('2026-01-01') };
    const active = { status: 'active', plan: { priceMonthlyCents: 1000 }, createdAt: new Date('2026-01-01') };
    mockedFind.mockReturnValue({ populate: jest.fn().mockResolvedValue([pastDue, active]) });

    const res = await request(app).get('/api/subscriptions/me').set('Cookie', authCookie());

    expect(res.status).toBe(200);
    expect(res.body.subscription.status).toBe('active');
  });

  // A subscription winding down still has paid-for time left on it, so it must outrank a
  // past_due one at the same price — that is what keeps access alive until the period ends.
  it('ranks canceling above past_due at the same price', async () => {
    const pastDue = { status: 'past_due', plan: { priceMonthlyCents: 1000 }, createdAt: new Date('2026-01-01') };
    const canceling = { status: 'canceling', plan: { priceMonthlyCents: 1000 }, createdAt: new Date('2026-01-01') };
    mockedFind.mockReturnValue({ populate: jest.fn().mockResolvedValue([pastDue, canceling]) });

    const res = await request(app).get('/api/subscriptions/me').set('Cookie', authCookie());

    expect(res.status).toBe(200);
    expect(res.body.subscription.status).toBe('canceling');
  });
});

describe('GET /api/subscriptions/mine', () => {
  it('lists all subscriptions for the user, newest first', async () => {
    const sortFn = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue([{ status: 'canceled' }]) });
    mockedFind.mockReturnValue({ sort: sortFn });

    const res = await request(app).get('/api/subscriptions/mine').set('Cookie', authCookie());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, subscriptions: [{ status: 'canceled' }] });
    expect(mockedFind).toHaveBeenCalledWith({ userEmail: 'user@example.com' });
    expect(sortFn).toHaveBeenCalledWith({ createdAt: -1 });
  });
});

describe('POST /api/subscriptions/cancel', () => {
  it('returns 404 when there is no cancellable subscription', async () => {
    mockedFindOne.mockResolvedValue(null);

    const res = await request(app).post('/api/subscriptions/cancel').set('Cookie', authCookie());

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: 'NotFoundError', message: 'No cancellable subscription' });
  });

  // Stripe was asked to stop at period end, so the user keeps the access they already paid
  // for. Marking `canceled` here would revoke it immediately, mid-paid-period.
  it('cancels via Stripe (cancel_at_period_end) and marks the subscription canceling, not canceled', async () => {
    const sub: any = {
      id: 'sub-doc-1',
      status: 'active',
      stripeSubscriptionId: 'sub_stripe_1',
      save: jest.fn().mockResolvedValue(undefined)
    };
    mockedFindOne.mockResolvedValue(sub);
    mockedStripeUpdate.mockResolvedValue({ id: 'sub_stripe_1', cancel_at_period_end: true, current_period_end: 1893456000 });

    const res = await request(app).post('/api/subscriptions/cancel').set('Cookie', authCookie());

    expect(res.status).toBe(200);
    expect(mockedStripeUpdate).toHaveBeenCalledWith('sub_stripe_1', { cancel_at_period_end: true });
    expect(sub.status).toBe('canceling');
    expect(sub.canceledAt).toBeUndefined();
    expect(sub.cancelAt).toEqual(new Date(1893456000 * 1000));
    expect(sub.save).toHaveBeenCalledTimes(1);
    expect(res.body).toMatchObject({
      success: true,
      stripe: { id: 'sub_stripe_1', cancel_at_period_end: true }
    });
  });

  // A local-only cancel here would revoke access while Stripe kept invoicing — worse than
  // reporting the failure, so the record must be left exactly as it was.
  it('leaves the subscription untouched and reports 502 when the Stripe call fails', async () => {
    const sub: any = {
      id: 'sub-doc-2',
      status: 'active',
      stripeSubscriptionId: 'sub_stripe_2',
      save: jest.fn().mockResolvedValue(undefined)
    };
    mockedFindOne.mockResolvedValue(sub);
    mockedStripeUpdate.mockRejectedValue(new Error('stripe unavailable'));

    const res = await request(app).post('/api/subscriptions/cancel').set('Cookie', authCookie());

    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({ success: false, code: 'STRIPE_CANCEL_FAILED' });
    expect(sub.status).toBe('active');
    expect(sub.save).not.toHaveBeenCalled();
  });

  it('cancels locally without calling Stripe when there is no stripeSubscriptionId (incomplete checkout)', async () => {
    const sub: any = {
      id: 'sub-doc-3',
      status: 'incomplete',
      stripeSubscriptionId: undefined,
      save: jest.fn().mockResolvedValue(undefined)
    };
    mockedFindOne.mockResolvedValue(sub);

    const res = await request(app).post('/api/subscriptions/cancel').set('Cookie', authCookie());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      subscription: { id: 'sub-doc-3', status: 'canceled' }
    });
    expect(mockedStripeUpdate).not.toHaveBeenCalled();
    expect(sub.status).toBe('canceled');
  });
});
