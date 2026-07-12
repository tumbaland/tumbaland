import { Request, Response } from 'express';

jest.mock('../models/User', () => ({
  User: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn()
  }
}));

import { User } from '../models/User';
import { getProfile, updateProfile } from './profileController';

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
    mockedFindById.mockResolvedValue({ firstName: 'Ada', lastName: 'Lovelace', isApproved: true });
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
        picture: 'pic.png'
      },
      approved: true
    });
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
        picture: 'pic.png'
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
});
