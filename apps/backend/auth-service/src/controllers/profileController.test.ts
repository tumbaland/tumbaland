import { Request, Response } from 'express';

jest.mock('../models/User', () => ({
  User: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn()
  }
}));
jest.mock('../services/sessionService', () => ({ renewSession: jest.fn() }));

import { User } from '../models/User';
import { renewSession } from '../services/sessionService';
import {
  cancelAccountDeletion,
  getProfile,
  requestAccountDeletion,
  updateProfile
} from './profileController';

const mockedFindById = User.findById as unknown as jest.Mock;
const mockedFindByIdAndUpdate = User.findByIdAndUpdate as unknown as jest.Mock;

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

const authedReq = (overrides: Partial<Request> = {}) =>
  ({
    user: { id: 'user-1', email: 'ada@example.com', name: 'Ada Lovelace', picture: 'pic.png' },
    body: {},
    ...overrides
  }) as unknown as Request;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getProfile', () => {
  it('throws UnauthorizedError (401) when req.user is missing', async () => {
    const res = mockRes();

    await expect(getProfile({ user: undefined } as unknown as Request, res)).rejects.toThrow('Not authenticated');
  });

  it('throws NotFoundError (404) when the DB user no longer exists', async () => {
    mockedFindById.mockResolvedValue(null);
    const res = mockRes();

    await expect(getProfile(authedReq(), res)).rejects.toThrow('User not found');
  });

  it('combines JWT and DB user data on success', async () => {
    const lastLoginAt = new Date('2026-07-27T10:00:00.000Z');
    mockedFindById.mockResolvedValue({ firstName: 'Ada', lastName: 'Lovelace', isApproved: true, lastLoginAt });
    const res = mockRes();

    await getProfile(authedReq(), res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      user: {
        id: 'user-1',
        email: 'ada@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
        name: 'Ada Lovelace',
        picture: 'pic.png',
        hasCustomPicture: false,
        lastLoginAt,
        deletionRequestedAt: null,
        showMoney: false
      },
      approved: true
    });
  });

  it('carries a standing deletion request, so the page can show it', async () => {
    // Without this the account page would offer to make a request that already
    // exists, and the person who made it would have no way to see that it took.
    const deletionRequestedAt = new Date('2026-09-01T10:00:00.000Z');
    mockedFindById.mockResolvedValue({ isApproved: true, deletionRequestedAt });
    const res = mockRes();

    await getProfile(authedReq(), res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.objectContaining({ deletionRequestedAt }) })
    );
  });
});

describe('showMoney', () => {
  it('is off for someone who never turned it on', async () => {
    mockedFindById.mockResolvedValue({ isApproved: true });
    const res = mockRes();

    await getProfile(authedReq(), res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ user: expect.objectContaining({ showMoney: false }) }));
  });

  it('saves the switch and answers with it', async () => {
    mockedFindByIdAndUpdate.mockResolvedValue({ _id: 'user-1', email: 'ada@example.com', showMoney: true });
    const res = mockRes();

    await updateProfile(authedReq({ body: { showMoney: true } }), res);

    expect(mockedFindByIdAndUpdate).toHaveBeenCalledWith('user-1', { $set: { showMoney: true } }, { new: true });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ user: expect.objectContaining({ showMoney: true }) }));
  });

  it('leaves the switch alone when a name is changed', async () => {
    mockedFindByIdAndUpdate.mockResolvedValue({ _id: 'user-1', email: 'ada@example.com' });

    await updateProfile(authedReq({ body: { firstName: 'Ada' } }), mockRes());

    expect(mockedFindByIdAndUpdate).toHaveBeenCalledWith('user-1', { $set: { firstName: 'Ada' } }, { new: true });
  });
});

describe('updateProfile', () => {
  it('throws UnauthorizedError (401) when req.user is missing', async () => {
    const res = mockRes();

    await expect(updateProfile({ user: undefined, body: {} } as unknown as Request, res)).rejects.toThrow(
      'Not authenticated'
    );
  });

  it('throws NotFoundError (404) when the DB user no longer exists', async () => {
    mockedFindByIdAndUpdate.mockResolvedValue(null);
    const res = mockRes();

    await expect(updateProfile(authedReq({ body: { firstName: 'New' } }), res)).rejects.toThrow('User not found');
  });

  it('trims and saves firstName/lastName, returning the updated user', async () => {
    mockedFindByIdAndUpdate.mockResolvedValue({
      _id: 'user-1',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace'
    });
    const res = mockRes();

    await updateProfile(authedReq({ body: { firstName: '  Ada  ', lastName: '  Lovelace  ' } }), res);

    expect(mockedFindByIdAndUpdate).toHaveBeenCalledWith(
      'user-1',
      { $set: { firstName: 'Ada', lastName: 'Lovelace' } },
      { new: true }
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      user: {
        id: 'user-1',
        email: 'ada@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
        name: 'Ada Lovelace',
        picture: 'pic.png',
        showMoney: false
      }
    });
  });

  it('converts an empty-string firstName/lastName to null instead of saving blank strings', async () => {
    mockedFindByIdAndUpdate.mockResolvedValue({ _id: 'user-1', email: 'ada@example.com' });
    const res = mockRes();

    await updateProfile(authedReq({ body: { firstName: '   ', lastName: '' } }), res);

    expect(mockedFindByIdAndUpdate).toHaveBeenCalledWith(
      'user-1',
      { $set: { firstName: null, lastName: null } },
      { new: true }
    );
  });

  it('leaves fields untouched when they are not present in the request body', async () => {
    mockedFindByIdAndUpdate.mockResolvedValue({ _id: 'user-1', email: 'ada@example.com' });
    const res = mockRes();

    await updateProfile(authedReq({ body: {} }), res);

    expect(mockedFindByIdAndUpdate).toHaveBeenCalledWith('user-1', { $set: {} }, { new: true });
  });

  it('returns the name they set rather than the one Google put in the token', async () => {
    mockedFindByIdAndUpdate.mockResolvedValue({ _id: 'user-1', email: 'ada@example.com', firstName: 'Augusta', lastName: 'King' });
    const res = mockRes();

    await updateProfile(authedReq({ body: { firstName: 'Augusta', lastName: 'King' } }), res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ user: expect.objectContaining({ name: 'Augusta King' }) }));
  });

  it('re-signs the session when the name changes, so chat shows it straight away', async () => {
    mockedFindByIdAndUpdate.mockResolvedValue({ _id: 'user-1', email: 'ada@example.com', firstName: 'Augusta' });
    const req = authedReq({ body: { firstName: 'Augusta' } });
    const res = mockRes();

    await updateProfile(req, res);

    expect(renewSession).toHaveBeenCalledWith(req, res, { reissue: true });
  });

  it('leaves the session alone when only a feature changes', async () => {
    mockedFindByIdAndUpdate.mockResolvedValue({ _id: 'user-1', email: 'ada@example.com', showMoney: true });

    await updateProfile(authedReq({ body: { showMoney: true } }), mockRes());

    expect(renewSession).not.toHaveBeenCalled();
  });
});

/**
 * Asking for the account to be removed.
 *
 * The whole point of these is that nothing happens to the data. A request is
 * recorded, an administrator acts on it later, and in the meantime the account
 * signs in and works exactly as it did before — so every test here is as much
 * about what is *not* touched as about the flag that is set.
 */
describe('requestAccountDeletion', () => {
  it('refuses an unauthenticated caller', async () => {
    await expect(
      requestAccountDeletion({ user: undefined } as unknown as Request, mockRes())
    ).rejects.toThrow('Not authenticated');
  });

  it('says so when the account is already gone', async () => {
    mockedFindById.mockResolvedValue(null);

    await expect(requestAccountDeletion(authedReq(), mockRes())).rejects.toThrow('User not found');
  });

  it('records when the request was made, and nothing else', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const user = { deletionRequestedAt: null, isApproved: true, tokenVersion: 1, save };
    mockedFindById.mockResolvedValue(user);
    const res = mockRes();

    await requestAccountDeletion(authedReq(), res);

    expect(user.deletionRequestedAt).toBeInstanceOf(Date);
    // Nothing is deleted and nothing is disabled: the account must keep working
    // while the request stands.
    expect(user.isApproved).toBe(true);
    expect(user.tokenVersion).toBe(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('tells the caller plainly that nothing has been removed', async () => {
    mockedFindById.mockResolvedValue({ deletionRequestedAt: null, save: jest.fn() });
    const res = mockRes();

    await requestAccountDeletion(authedReq(), res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: expect.stringMatching(/Nothing has been removed yet/)
      })
    );
  });

  it('keeps the original date when asked twice', async () => {
    // Re-clicking a button is not a second request, and the date an
    // administrator works from should be when the person actually decided.
    const asked = new Date('2026-09-01T10:00:00.000Z');
    const save = jest.fn();
    mockedFindById.mockResolvedValue({ deletionRequestedAt: asked, save });
    const res = mockRes();

    await requestAccountDeletion(authedReq(), res);

    expect(save).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ deletionRequestedAt: asked })
    );
  });
});

describe('cancelAccountDeletion', () => {
  it('refuses an unauthenticated caller', async () => {
    await expect(
      cancelAccountDeletion({ user: undefined } as unknown as Request, mockRes())
    ).rejects.toThrow('Not authenticated');
  });

  it('clears the request', async () => {
    mockedFindByIdAndUpdate.mockResolvedValue({ deletionRequestedAt: null });
    const res = mockRes();

    await cancelAccountDeletion(authedReq(), res);

    expect(mockedFindByIdAndUpdate).toHaveBeenCalledWith(
      'user-1',
      { $set: { deletionRequestedAt: null } },
      { new: true }
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, deletionRequestedAt: null })
    );
  });

  it('says so when the account is already gone', async () => {
    mockedFindByIdAndUpdate.mockResolvedValue(null);

    await expect(cancelAccountDeletion(authedReq(), mockRes())).rejects.toThrow('User not found');
  });
});
