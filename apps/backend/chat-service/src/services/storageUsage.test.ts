const getGroupOwner = jest.fn();
const getEntitlements = jest.fn();
const checkQuota = jest.fn();
const recordUsage = jest.fn();
const releaseQuota = jest.fn();

jest.mock('@tumbaland/backend-core', () => ({
  getGroupOwner: (...args: unknown[]) => getGroupOwner(...args),
  getEntitlements: (...args: unknown[]) => getEntitlements(...args),
  checkQuota: (...args: unknown[]) => checkQuota(...args),
  recordUsage: (...args: unknown[]) => recordUsage(...args),
  releaseQuota: (...args: unknown[]) => releaseQuota(...args),
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() }
}));

import { assertHeadroom, recordStoredBytes, releaseStoredBytes } from './storageUsage';
import type { Caller } from './accessService';

const TOM: Caller = { id: 'u-tom', email: 'tom@example.com', name: 'Tom', groups: ['g1'] };

beforeEach(() => {
  // Implementations are re-set rather than cleared: `clearAllMocks` forgets
  // calls but keeps a `mockRejectedValue` from a previous test, which then
  // fails whichever test happens to run next.
  getGroupOwner.mockReset().mockResolvedValue({ ownerEmail: 'owner@example.com' });
  getEntitlements.mockReset().mockResolvedValue({ limits: { meters: { storageBytes: 1_000_000 } } });
  checkQuota.mockReset().mockResolvedValue(undefined);
  recordUsage.mockReset().mockResolvedValue(undefined);
  releaseQuota.mockReset().mockResolvedValue(undefined);
});

describe('assertHeadroom', () => {
  it('checks the group owner’s allowance, not the uploader’s', async () => {
    // Family sells pooled storage: a member's own free gigabyte is not the pool.
    await assertHeadroom(TOM, 'g1', 500);

    expect(getEntitlements).toHaveBeenCalledWith('owner@example.com');
    expect(checkQuota).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: 'owner@example.com', meter: 'storageBytes', amount: 500 })
    );
  });

  it('propagates the 402 when the upload would not fit', async () => {
    checkQuota.mockRejectedValue(new Error('Storage limit reached'));

    await expect(assertHeadroom(TOM, 'g1', 5_000_000)).rejects.toThrow('Storage limit reached');
  });

  it('rounds a fractional size down to whole bytes', async () => {
    await assertHeadroom(TOM, 'g1', 500.9);

    expect(checkQuota).toHaveBeenCalledWith(expect.objectContaining({ amount: 500 }));
  });

  it('never asks for a negative amount', async () => {
    await assertHeadroom(TOM, 'g1', -10);

    expect(checkQuota).toHaveBeenCalledWith(expect.objectContaining({ amount: 0 }));
  });

  it('allows the upload when group-service cannot be reached', async () => {
    // Refusing would be harsher than what the entitlements client does for the
    // same outage, and storage is reconciled nightly anyway.
    getGroupOwner.mockRejectedValue(new Error('group-service down'));

    await expect(assertHeadroom(TOM, 'g1', 500)).resolves.toBeUndefined();
    expect(checkQuota).not.toHaveBeenCalled();
  });

  it('allows the upload when the group has no owner on record', async () => {
    getGroupOwner.mockResolvedValue({ ownerEmail: null });

    await expect(assertHeadroom(TOM, 'g1', 500)).resolves.toBeUndefined();
    expect(checkQuota).not.toHaveBeenCalled();
  });
});

describe('recordStoredBytes', () => {
  it('bills the group owner', async () => {
    await recordStoredBytes('g1', 1234);

    expect(recordUsage).toHaveBeenCalledWith('owner@example.com', 'storageBytes', 1234);
  });

  it('records nothing for a message with no attachments', async () => {
    await recordStoredBytes('g1', 0);

    expect(recordUsage).not.toHaveBeenCalled();
    expect(getGroupOwner).not.toHaveBeenCalled();
  });

  it('records nothing rather than billing the wrong account when the owner is unknown', async () => {
    getGroupOwner.mockResolvedValue(null);

    await recordStoredBytes('g1', 1234);

    expect(recordUsage).not.toHaveBeenCalled();
  });
});

describe('releaseStoredBytes', () => {
  it('hands the bytes back to the group owner', async () => {
    // A cumulative meter that only counts up locks people out of storage they
    // freed months earlier.
    await releaseStoredBytes('g1', 1234);

    expect(releaseQuota).toHaveBeenCalledWith('owner@example.com', 'storageBytes', 1234);
  });

  it('does nothing when there were no bytes', async () => {
    await releaseStoredBytes('g1', 0);

    expect(releaseQuota).not.toHaveBeenCalled();
  });

  it('does nothing when the owner cannot be resolved', async () => {
    getGroupOwner.mockRejectedValue(new Error('group-service down'));

    await releaseStoredBytes('g1', 1234);

    expect(releaseQuota).not.toHaveBeenCalled();
  });
});
