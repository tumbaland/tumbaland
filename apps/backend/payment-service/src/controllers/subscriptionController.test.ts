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
      status: { $in: ['active', 'past_due', 'incomplete'] }
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

  it('cancels via Stripe (cancel_at_period_end) and marks the subscription canceled locally', async () => {
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
    expect(sub.status).toBe('canceled');
    expect(sub.canceledAt).toBeInstanceOf(Date);
    expect(sub.save).toHaveBeenCalledTimes(1);
    expect(res.body).toMatchObject({
      success: true,
      stripe: { id: 'sub_stripe_1', cancel_at_period_end: true }
    });
  });

  it('falls back to a local-only cancel when the Stripe call fails', async () => {
    const sub: any = {
      id: 'sub-doc-2',
      status: 'active',
      stripeSubscriptionId: 'sub_stripe_2',
      save: jest.fn().mockResolvedValue(undefined)
    };
    mockedFindOne.mockResolvedValue(sub);
    mockedStripeUpdate.mockRejectedValue(new Error('stripe unavailable'));

    const res = await request(app).post('/api/subscriptions/cancel').set('Cookie', authCookie());

    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({
      success: true,
      warning: 'stripe_cancel_failed_local_only',
      subscription: { id: 'sub-doc-2', status: 'canceled', stripeSubscriptionId: 'sub_stripe_2' }
    });
    expect(sub.status).toBe('canceled');
    expect(sub.save).toHaveBeenCalledTimes(1);
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
