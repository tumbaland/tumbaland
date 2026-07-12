import { Request, Response } from 'express';

jest.mock('../models/Payment', () => ({ Payment: { create: jest.fn(), find: jest.fn() } }));

import { Payment } from '../models/Payment';
import { createOneTimePayment, listPayments } from './paymentController';

const mockedCreate = Payment.create as jest.Mock;
const mockedFind = Payment.find as jest.Mock;

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

const baseReq = (overrides: Partial<Request> = {}) =>
  ({ user: { email: 'user@example.com' }, body: {}, ...overrides }) as unknown as Request;

beforeEach(() => jest.clearAllMocks());

describe('createOneTimePayment', () => {
  it('creates a succeeded one-time payment, defaulting currency to eur', async () => {
    mockedCreate.mockResolvedValue({ _id: 'p1' });
    const res = mockRes();

    await createOneTimePayment(baseReq({ body: { amountCents: 1000 } }), res);

    expect(mockedCreate).toHaveBeenCalledWith({
      userEmail: 'user@example.com',
      amountCents: 1000,
      currency: 'eur',
      type: 'one_time',
      status: 'succeeded'
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('respects an explicit currency', async () => {
    mockedCreate.mockResolvedValue({ _id: 'p1' });
    const res = mockRes();

    await createOneTimePayment(baseReq({ body: { amountCents: 1000, currency: 'usd' } }), res);

    expect(mockedCreate).toHaveBeenCalledWith(expect.objectContaining({ currency: 'usd' }));
  });
});

describe('listPayments', () => {
  it('lists the caller\'s payments, most recent first, capped at 50', async () => {
    const sort = jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([{ _id: 'p1' }]) });
    mockedFind.mockReturnValue({ sort });
    const res = mockRes();

    await listPayments(baseReq(), res);

    expect(mockedFind).toHaveBeenCalledWith({ userEmail: 'user@example.com' });
    expect(res.json).toHaveBeenCalledWith({ success: true, payments: [{ _id: 'p1' }] });
  });
});
