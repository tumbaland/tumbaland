import { Request, Response } from 'express';

jest.mock('../services/snapshot.service', () => ({
  getSnapshots: jest.fn(),
  upsertSnapshot: jest.fn(),
  deleteSnapshot: jest.fn()
}));

import * as snapshotService from '../services/snapshot.service';
import { getSnapshots, upsertSnapshot, deleteSnapshot } from './snapshot.controller';

const mocked = snapshotService as jest.Mocked<typeof snapshotService>;

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

const baseReq = (overrides: Partial<Request> = {}) =>
  ({ user: { id: 'user-1' }, userGroups: [], body: {}, params: {}, query: {}, ...overrides }) as unknown as Request;

beforeEach(() => jest.clearAllMocks());

describe('getSnapshots', () => {
  it('fetches personal snapshots when no groupId is given', async () => {
    mocked.getSnapshots.mockResolvedValue([]);
    const res = mockRes();

    await getSnapshots(baseReq(), res);

    expect(mocked.getSnapshots).toHaveBeenCalledWith('user-1', undefined);
  });

  it('reads groupId from the query string and validates membership', async () => {
    mocked.getSnapshots.mockResolvedValue([]);
    const res = mockRes();

    await getSnapshots(baseReq({ query: { groupId: 'g1' }, userGroups: ['g1'] }), res);

    expect(mocked.getSnapshots).toHaveBeenCalledWith('user-1', 'g1');
  });

  it('throws ForbiddenError for a group the user is not a member of', async () => {
    const res = mockRes();
    await expect(getSnapshots(baseReq({ query: { groupId: 'g1' } }), res)).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
  });
});

describe('upsertSnapshot', () => {
  it('throws BadRequestError for a malformed month param', async () => {
    const res = mockRes();
    await expect(upsertSnapshot(baseReq({ params: { month: 'not-a-month' } }), res)).rejects.toMatchObject({
      name: 'BadRequestError'
    });
  });

  it('accepts groupId from the body as well as the query', async () => {
    mocked.upsertSnapshot.mockResolvedValue({ _id: 's1' } as any);
    const res = mockRes();

    await upsertSnapshot(
      baseReq({ params: { month: '2026-03' }, body: { groupId: 'g1', entries: [] }, userGroups: ['g1'] }),
      res
    );

    expect(mocked.upsertSnapshot).toHaveBeenCalledWith('2026-03', [], 'user-1', 'g1');
  });

  it('saves a valid snapshot for the current user (no group)', async () => {
    mocked.upsertSnapshot.mockResolvedValue({ _id: 's1' } as any);
    const res = mockRes();

    await upsertSnapshot(baseReq({ params: { month: '2026-01' }, body: { entries: [{ ticker: 'AAPL' }] } }), res);

    expect(mocked.upsertSnapshot).toHaveBeenCalledWith('2026-01', [{ ticker: 'AAPL' }], 'user-1', undefined);
  });
});

describe('deleteSnapshot', () => {
  it('deletes the snapshot', async () => {
    mocked.deleteSnapshot.mockResolvedValue(undefined as any);
    const res = mockRes();

    await deleteSnapshot(baseReq({ params: { id: 's1' } }), res);

    expect(mocked.deleteSnapshot).toHaveBeenCalledWith('s1', 'user-1', []);
  });
});
