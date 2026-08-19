// Only the entitlement/usage calls are stubbed; the error classes and the
// logger stay real, so a rejection here is the same object a route would throw.
jest.mock('@tumbaland/backend-core', () => ({
  ...jest.requireActual('@tumbaland/backend-core'),
  getGroupOwner: jest.fn(),
  getEntitlements: jest.fn(),
  checkQuota: jest.fn(),
  recordUsage: jest.fn(),
  releaseQuota: jest.fn()
}));

import { Request } from 'express';
import {
  PaymentRequiredError,
  checkQuota,
  getEntitlements,
  getGroupOwner,
  recordUsage,
  releaseQuota
} from '@tumbaland/backend-core';
import {
  assertStorageHeadroom,
  recordStoredBytes,
  releaseStoredBytes,
  storageActor,
  transferStoredBytes
} from './storageUsage';

const mockedGetGroupOwner = getGroupOwner as jest.Mock;
const mockedGetEntitlements = getEntitlements as jest.Mock;
const mockedCheckQuota = checkQuota as jest.Mock;
const mockedRecordUsage = recordUsage as jest.Mock;
const mockedReleaseQuota = releaseQuota as jest.Mock;

const CALLER = 'caller@example.com';
const OWNER = 'owner@example.com';

const actor = (overrides: Record<string, unknown> = {}) => ({
  email: CALLER,
  userId: 'user-1',
  route: '/api/photos/upload-url',
  ...overrides
});

const entitlements = { email: CALLER, planCode: 'free', limits: { meters: { storageBytes: 1_000 } } };

beforeEach(() => {
  jest.resetAllMocks();
  mockedGetEntitlements.mockResolvedValue(entitlements);
  mockedGetGroupOwner.mockResolvedValue(null);
});

describe('storageActor', () => {
  it('takes the email, the auth id and the route off the request', () => {
    const req = {
      user: { id: 'user-1', email: CALLER },
      originalUrl: '/api/photos/upload-url'
    } as unknown as Request;

    expect(storageActor(req)).toEqual({ email: CALLER, userId: 'user-1', route: '/api/photos/upload-url' });
  });
});

describe('assertStorageHeadroom', () => {
  it('bills a personal album to the caller', async () => {
    await assertStorageHeadroom(actor(), { userId: 'user-1' }, 500);

    expect(mockedGetEntitlements).toHaveBeenCalledWith(CALLER);
    expect(mockedCheckQuota).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: CALLER, meter: 'storageBytes', amount: 500 })
    );
  });

  it('bills a group album to the group owner, not the uploader', async () => {
    // Family sells 250 GB *pooled*; charging the uploader would spend their own
    // free gigabyte on a shared album instead.
    mockedGetGroupOwner.mockResolvedValue({ ownerEmail: OWNER });

    await assertStorageHeadroom(actor(), { userId: 'user-2', groupId: 'group-1' }, 500);

    expect(mockedGetEntitlements).toHaveBeenCalledWith(OWNER);
    expect(mockedCheckQuota).toHaveBeenCalledWith(expect.objectContaining({ subjectId: OWNER }));
  });

  it('falls back to the caller when group-service cannot be reached', async () => {
    // Harsher denial would exceed what the entitlement client itself does for
    // the same outage, and the common case checks the *smaller* allowance.
    mockedGetGroupOwner.mockRejectedValue(new Error('connection refused'));

    await assertStorageHeadroom(actor(), { userId: 'user-1', groupId: 'group-1' }, 500);

    expect(mockedCheckQuota).toHaveBeenCalledWith(expect.objectContaining({ subjectId: CALLER }));
  });

  it('propagates the 402 the quota check throws', async () => {
    mockedCheckQuota.mockRejectedValue(
      new PaymentRequiredError('Limit reached for storageBytes', { code: 'QUOTA_EXCEEDED', meter: 'storageBytes' })
    );

    await expect(assertStorageHeadroom(actor(), { userId: 'user-1' }, 5_000)).rejects.toMatchObject({
      statusCode: 402
    });
  });

  it('checks nothing when there is no billable subject at all', async () => {
    await assertStorageHeadroom(actor({ email: undefined }), { userId: 'user-1' }, 500);

    expect(mockedCheckQuota).not.toHaveBeenCalled();
  });
});

describe('recordStoredBytes', () => {
  it('records against the group owner for a group album', async () => {
    mockedGetGroupOwner.mockResolvedValue({ ownerEmail: OWNER });

    await recordStoredBytes(actor(), { userId: 'user-2', groupId: 'group-1' }, 4_096);

    expect(mockedRecordUsage).toHaveBeenCalledWith(OWNER, 'storageBytes', 4_096);
  });

  it('records nothing when the subject was only inferred', async () => {
    // Charging the wrong meter is worse than a counter that lags: storage is
    // derived, so the nightly reconciliation re-derives it from the photos.
    mockedGetGroupOwner.mockResolvedValue(null);

    await recordStoredBytes(actor(), { userId: 'user-1', groupId: 'group-1' }, 4_096);

    expect(mockedRecordUsage).not.toHaveBeenCalled();
  });

  it('records nothing for a personal album belonging to someone else', async () => {
    await recordStoredBytes(actor(), { userId: 'someone-else' }, 4_096);

    expect(mockedRecordUsage).not.toHaveBeenCalled();
  });

  it('ignores a zero-byte write', async () => {
    await recordStoredBytes(actor(), { userId: 'user-1' }, 0);

    expect(mockedRecordUsage).not.toHaveBeenCalled();
  });
});

describe('releaseStoredBytes', () => {
  it('hands deleted bytes back to the meter that holds them', async () => {
    mockedGetGroupOwner.mockResolvedValue({ ownerEmail: OWNER });

    await releaseStoredBytes(actor(), { userId: 'user-2', groupId: 'group-1' }, 2_048);

    expect(mockedReleaseQuota).toHaveBeenCalledWith(OWNER, 'storageBytes', 2_048);
  });

  it('releases nothing it cannot attribute', async () => {
    await releaseStoredBytes(actor({ email: undefined }), { userId: 'user-1' }, 2_048);

    expect(mockedReleaseQuota).not.toHaveBeenCalled();
  });
});

describe('transferStoredBytes', () => {
  it('moves an album between meters when it changes group', async () => {
    mockedGetGroupOwner.mockResolvedValue({ ownerEmail: OWNER });

    await transferStoredBytes(actor(), { userId: 'user-1' }, { userId: 'user-1', groupId: 'group-1' }, 9_000);

    expect(mockedReleaseQuota).toHaveBeenCalledWith(CALLER, 'storageBytes', 9_000);
    expect(mockedRecordUsage).toHaveBeenCalledWith(OWNER, 'storageBytes', 9_000);
  });

  it('does nothing when the group did not change', async () => {
    await transferStoredBytes(
      actor(),
      { userId: 'user-1', groupId: 'group-1' },
      { userId: 'user-1', groupId: 'group-1' },
      9_000
    );

    expect(mockedReleaseQuota).not.toHaveBeenCalled();
    expect(mockedRecordUsage).not.toHaveBeenCalled();
  });

  it('does nothing for an empty album', async () => {
    await transferStoredBytes(actor(), { userId: 'user-1' }, { userId: 'user-1', groupId: 'group-1' }, 0);

    expect(mockedReleaseQuota).not.toHaveBeenCalled();
  });
});
