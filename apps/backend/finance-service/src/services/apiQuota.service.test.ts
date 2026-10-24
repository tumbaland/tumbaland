jest.mock('../models/ApiUsage', () => ({
  __esModule: true,
  default: { findOne: jest.fn(), findOneAndUpdate: jest.fn(), updateOne: jest.fn() }
}));

import ApiUsage from '../models/ApiUsage';
import {
  PROVIDER,
  DAILY_LIMIT,
  getRemainingQuota,
  consumeQuota,
  releaseQuota,
} from './apiQuota.service';

const mockedFindOne = ApiUsage.findOne as unknown as jest.Mock;
const mockedFindOneAndUpdate = ApiUsage.findOneAndUpdate as unknown as jest.Mock;
const mockedUpdateOne = ApiUsage.updateOne as unknown as jest.Mock;

const today = () => new Date().toISOString().slice(0, 10);

beforeEach(() => jest.clearAllMocks());

describe('DAILY_LIMIT', () => {
  it("matches the provider's free-plan allowance", () => {
    expect(DAILY_LIMIT).toBe(25);
  });
});

describe('getRemainingQuota', () => {
  it('reports the day as untouched when nothing has been recorded', async () => {
    mockedFindOne.mockResolvedValue(null);

    expect(await getRemainingQuota()).toEqual({
      limit: DAILY_LIMIT,
      used: 0,
      remaining: DAILY_LIMIT,
      date: today()
    });
  });

  it('subtracts what has been used', async () => {
    mockedFindOne.mockResolvedValue({ count: 20 });

    expect(await getRemainingQuota()).toMatchObject({ used: 20, remaining: 5 });
  });

  it('never reports a negative remainder', async () => {
    mockedFindOne.mockResolvedValue({ count: 40 });

    expect(await getRemainingQuota()).toMatchObject({ used: 40, remaining: 0 });
  });
});

describe('consumeQuota', () => {
  it('reserves the call atomically against today, upserting the counter', async () => {
    mockedFindOneAndUpdate.mockResolvedValue({ count: 1 });

    await consumeQuota();

    expect(mockedFindOneAndUpdate).toHaveBeenCalledWith(
      { provider: PROVIDER, date: today() },
      { $inc: { count: 1 } },
      { upsert: true, new: true }
    );
  });

  it('allows the call that lands exactly on the limit', async () => {
    mockedFindOneAndUpdate.mockResolvedValue({ count: 25 });

    await expect(consumeQuota()).resolves.toBeUndefined();
  });

  it('rejects the call that would exceed the limit', async () => {
    mockedFindOneAndUpdate.mockResolvedValue({ count: 26 });

    await expect(consumeQuota()).rejects.toMatchObject({ name: 'TooManyRequestsError' });
  });

  it('rejects the loser of a race rather than letting both requests through', async () => {
    // Two concurrent reservations on a limit of 25: increments resolve to 25
    // and 26, so exactly one is rejected.
    mockedFindOneAndUpdate.mockResolvedValueOnce({ count: 25 }).mockResolvedValueOnce({ count: 26 });

    const results = await Promise.allSettled([consumeQuota(), consumeQuota()]);

    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected']);
  });
});

describe('releaseQuota', () => {
  it('decrements only a counter that is above zero', async () => {
    mockedUpdateOne.mockResolvedValue({});

    await releaseQuota();

    expect(mockedUpdateOne).toHaveBeenCalledWith(
      { provider: PROVIDER, date: today(), count: { $gt: 0 } },
      { $inc: { count: -1 } }
    );
  });

  it('swallows a failure so a release error cannot mask the original one', async () => {
    mockedUpdateOne.mockRejectedValue(new Error('mongo down'));

    await expect(releaseQuota()).resolves.toBeUndefined();
  });
});
