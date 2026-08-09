jest.mock('../models/TrackedTicker', () => ({ __esModule: true, default: { exists: jest.fn() } }));

// Only the entitlement/usage calls are stubbed; the error classes and the
// logger stay real, so a rejection here is the same object a route would throw.
jest.mock('@tumbaland/backend-core', () => ({
  ...jest.requireActual('@tumbaland/backend-core'),
  getGroupOwner: jest.fn(),
  getEntitlements: jest.fn(),
  consumeQuota: jest.fn(),
  releaseQuota: jest.fn()
}));

import { Request } from 'express';
import { consumeQuota, getEntitlements, getGroupOwner, releaseQuota } from '@tumbaland/backend-core';
import TrackedTicker from '../models/TrackedTicker';
import {
  releaseTickerSlot,
  reserveTickerSlot,
  resolveTickerScope,
  tickerActor,
  withTickerSlot,
  withTickerUpdate
} from './trackedTickerUsage';

const mockedExists = TrackedTicker.exists as unknown as jest.Mock;
const mockedGetGroupOwner = getGroupOwner as jest.Mock;
const mockedGetEntitlements = getEntitlements as jest.Mock;
const mockedConsume = consumeQuota as jest.Mock;
const mockedRelease = releaseQuota as jest.Mock;

const CALLER = 'caller@example.com';
const OWNER = 'owner@example.com';

const actor = (overrides: Record<string, unknown> = {}) => ({
  email: CALLER,
  userId: 'user-1',
  groups: [] as string[],
  route: '/api/tracked-tickers',
  ...overrides
});

const entitlements = { email: CALLER, planCode: 'free', limits: { meters: { trackedTickers: 3 } } };

/** No row anywhere tracks the symbol yet. */
const untracked = () => mockedExists.mockResolvedValue(null);
/** Something already tracks it for this subject. */
const tracked = () => mockedExists.mockResolvedValue({ _id: 'existing' });

beforeEach(() => {
  // Reset, not clear: one test makes consumeQuota reject, and an implementation
  // that outlives its test fails every later one.
  jest.resetAllMocks();
  mockedGetEntitlements.mockResolvedValue(entitlements);
  mockedGetGroupOwner.mockResolvedValue(null);
});

describe('resolveTickerScope', () => {
  it('bills a personal write to the caller and looks at their personal rows', async () => {
    const scope = await resolveTickerScope(actor());

    expect(scope).toEqual({
      subject: CALLER,
      scopes: [{ userId: 'user-1', groupId: null }]
    });
  });

  it('bills a group write to the group owner, not the caller', async () => {
    mockedGetGroupOwner.mockResolvedValue({ ownerEmail: OWNER });

    const scope = await resolveTickerScope(actor(), 'g1');

    expect(scope?.subject).toBe(OWNER);
    // The owner's other scopes are invisible from here, so only the group is
    // checked for the symbol.
    expect(scope?.scopes).toEqual([{ groupId: 'g1' }]);
  });

  it('counts a symbol once across the caller\'s personal rows and the groups they own', async () => {
    mockedGetGroupOwner.mockImplementation(async (id: string) =>
      id === 'g-own' ? { ownerEmail: CALLER } : { ownerEmail: OWNER }
    );

    const scope = await resolveTickerScope(actor({ groups: ['g-own', 'g-other'] }));

    expect(scope?.subject).toBe(CALLER);
    expect(scope?.scopes).toEqual([{ userId: 'user-1', groupId: null }, { groupId: 'g-own' }]);
  });

  it('falls back to the caller when the group owner cannot be resolved', async () => {
    mockedGetGroupOwner.mockResolvedValue(null);

    const scope = await resolveTickerScope(actor(), 'g1');

    expect(scope?.subject).toBe(CALLER);
  });

  it('meters nothing when the request carries no email to bill', async () => {
    expect(await resolveTickerScope(actor({ email: undefined }))).toBeNull();
  });
});

describe('reserveTickerSlot', () => {
  it('consumes a slot for a symbol the subject does not already track', async () => {
    untracked();

    await reserveTickerSlot(actor(), { ticker: 'AAPL' });

    expect(mockedConsume).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: CALLER, meter: 'trackedTickers', amount: 1, entitlements })
    );
  });

  it('is free when the subject already tracks the symbol', async () => {
    tracked();

    await reserveTickerSlot(actor(), { ticker: 'AAPL' });

    expect(mockedConsume).not.toHaveBeenCalled();
  });

  it('only counts active rows as covering a symbol', async () => {
    untracked();

    await reserveTickerSlot(actor(), { ticker: 'AAPL' });

    expect(mockedExists).toHaveBeenCalledWith(expect.objectContaining({ ticker: 'AAPL', isActive: true }));
  });

  it('costs nothing for a ticker added paused — it is never fetched', async () => {
    await reserveTickerSlot(actor(), { ticker: 'AAPL', isActive: false });

    expect(mockedExists).not.toHaveBeenCalled();
    expect(mockedConsume).not.toHaveBeenCalled();
  });

  it('propagates the 402 when the reservation would overrun the plan', async () => {
    untracked();
    mockedConsume.mockRejectedValue(Object.assign(new Error('Limit reached'), { name: 'PaymentRequiredError' }));

    await expect(reserveTickerSlot(actor(), { ticker: 'AAPL' })).rejects.toMatchObject({
      name: 'PaymentRequiredError'
    });
  });

  it('returns a rollback that hands the slot back', async () => {
    untracked();

    const rollback = await reserveTickerSlot(actor(), { ticker: 'AAPL' });
    await rollback();

    expect(mockedRelease).toHaveBeenCalledWith(CALLER, 'trackedTickers', 1);
  });
});

describe('withTickerSlot', () => {
  it('keeps the slot when the write succeeds', async () => {
    untracked();

    await expect(withTickerSlot(actor(), { ticker: 'AAPL' }, async () => 'created')).resolves.toBe('created');
    expect(mockedRelease).not.toHaveBeenCalled();
  });

  it('hands the slot back when the write fails', async () => {
    untracked();

    await expect(
      withTickerSlot(actor(), { ticker: 'AAPL' }, async () => {
        throw new Error('duplicate key');
      })
    ).rejects.toThrow('duplicate key');

    expect(mockedRelease).toHaveBeenCalledWith(CALLER, 'trackedTickers', 1);
  });
});

describe('releaseTickerSlot', () => {
  it('releases once nothing tracks the symbol any more', async () => {
    untracked();

    await releaseTickerSlot(actor(), { ticker: 'AAPL', isActive: true });

    expect(mockedRelease).toHaveBeenCalledWith(CALLER, 'trackedTickers', 1);
  });

  it('keeps the slot while another row still tracks the symbol', async () => {
    tracked();

    await releaseTickerSlot(actor(), { ticker: 'AAPL', isActive: true });

    expect(mockedRelease).not.toHaveBeenCalled();
  });

  it('does nothing for a paused row, which never held a slot', async () => {
    await releaseTickerSlot(actor(), { ticker: 'AAPL', isActive: false });

    expect(mockedRelease).not.toHaveBeenCalled();
  });

  it('releases from the group owner when the row lived in a group', async () => {
    mockedGetGroupOwner.mockResolvedValue({ ownerEmail: OWNER });
    untracked();

    await releaseTickerSlot(actor(), { ticker: 'AAPL', groupId: 'g1', isActive: true });

    expect(mockedRelease).toHaveBeenCalledWith(OWNER, 'trackedTickers', 1);
  });
});

describe('withTickerUpdate', () => {
  const before = { id: 't1', ticker: 'AAPL', isActive: true };

  it('leaves the meter alone when nothing billable changed', async () => {
    await withTickerUpdate(actor(), before, { ticker: 'AAPL' }, async () => 'updated');

    expect(mockedConsume).not.toHaveBeenCalled();
    expect(mockedRelease).not.toHaveBeenCalled();
  });

  it('moves the slot when the symbol is renamed', async () => {
    untracked();

    await withTickerUpdate(actor(), before, { ticker: 'MSFT' }, async () => 'updated');

    expect(mockedConsume).toHaveBeenCalledWith(expect.objectContaining({ meter: 'trackedTickers' }));
    expect(mockedRelease).toHaveBeenCalledWith(CALLER, 'trackedTickers', 1);
  });

  it('ignores the row being updated when asking whether the new symbol is covered', async () => {
    untracked();

    await withTickerUpdate(actor(), before, { ticker: 'MSFT' }, async () => 'updated');

    expect(mockedExists).toHaveBeenCalledWith(expect.objectContaining({ _id: { $ne: 't1' } }));
  });

  it('releases the slot when the ticker is paused', async () => {
    untracked();

    await withTickerUpdate(actor(), before, { isActive: false }, async () => 'updated');

    expect(mockedConsume).not.toHaveBeenCalled();
    expect(mockedRelease).toHaveBeenCalledWith(CALLER, 'trackedTickers', 1);
  });

  it('takes a slot when a paused ticker is resumed', async () => {
    untracked();

    await withTickerUpdate(
      actor(),
      { ...before, isActive: false },
      { isActive: true },
      async () => 'updated'
    );

    expect(mockedConsume).toHaveBeenCalledWith(expect.objectContaining({ meter: 'trackedTickers' }));
    expect(mockedRelease).not.toHaveBeenCalled();
  });

  it('rolls back the reservation when the update fails', async () => {
    untracked();

    await expect(
      withTickerUpdate(actor(), before, { ticker: 'MSFT' }, async () => {
        throw new Error('nope');
      })
    ).rejects.toThrow('nope');

    expect(mockedRelease).toHaveBeenCalledWith(CALLER, 'trackedTickers', 1);
  });

  it('writes without metering when the row does not exist', async () => {
    await expect(withTickerUpdate(actor(), null, { ticker: 'MSFT' }, async () => null)).resolves.toBeNull();

    expect(mockedConsume).not.toHaveBeenCalled();
  });
});

describe('tickerActor', () => {
  it('carries the email, user id, groups and route off the request', () => {
    const req = {
      user: { id: 'user-1', email: CALLER },
      userGroups: ['g1'],
      originalUrl: '/api/tracked-tickers'
    } as unknown as Request;

    expect(tickerActor(req)).toEqual({
      email: CALLER,
      userId: 'user-1',
      groups: ['g1'],
      route: '/api/tracked-tickers'
    });
  });
});
