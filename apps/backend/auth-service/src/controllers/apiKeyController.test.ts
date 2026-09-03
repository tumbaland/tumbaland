import { Request, Response } from 'express';

jest.mock('@tumbaland/backend-core', () => {
  const actual = jest.requireActual('@tumbaland/backend-core');
  return {
    ...actual,
    createApiKey: jest.fn(),
    listApiKeys: jest.fn(),
    revealApiKey: jest.fn(),
    revokeApiKey: jest.fn(),
    deleteApiKey: jest.fn(),
    isEncryptionConfigured: () => Boolean(process.env.API_KEY_ENCRYPTION_SECRET),
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
  };
});

import {
  createApiKey,
  listApiKeys,
  revealApiKey,
  revokeApiKey,
  deleteApiKey
} from '@tumbaland/backend-core';
import {
  requireApiKeysConfigured,
  getApiKeys,
  postApiKey,
  postApiKeyReveal,
  postApiKeyRevoke,
  removeApiKey
} from './apiKeyController';

const mockedCreate = createApiKey as jest.Mock;
const mockedList = listApiKeys as jest.Mock;
const mockedReveal = revealApiKey as jest.Mock;
const mockedRevoke = revokeApiKey as jest.Mock;
const mockedDelete = deleteApiKey as jest.Mock;

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

const req = (over: Partial<Request> = {}): Request =>
  ({
    user: { id: 'u1', email: 'u1@example.com', name: 'Tester' },
    userGroups: ['g1'],
    params: {},
    body: {},
    ...over
  }) as unknown as Request;

const summary = { id: 'k1', name: 'Claude', prefix: 'tmb_live_abcdef123456' };

beforeEach(() => jest.clearAllMocks());

describe('getApiKeys', () => {
  it('lists only the caller’s keys', async () => {
    mockedList.mockResolvedValue([summary]);
    const res = mockRes();

    await getApiKeys(req(), res);

    expect(mockedList).toHaveBeenCalledWith('u1');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: [summary] }));
  });
});

describe('postApiKey', () => {
  beforeEach(() => mockedCreate.mockResolvedValue({ summary, token: 'tmb_live_abcdef123456_secret' }));

  it('creates a personal key and returns the token exactly once, with a 201', async () => {
    const res = mockRes();
    const request = req({ body: { name: 'Claude', scopes: ['relationship:write'] } });

    await postApiKey(request, res);

    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', name: 'Claude', groupId: null })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ token: 'tmb_live_abcdef123456_secret' }) })
    );
  });

  it('snapshots the owner’s identity onto the key', async () => {
    await postApiKey(req({ body: { name: 'Claude', scopes: ['relationship:read'] } }), mockRes());

    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({ userEmail: 'u1@example.com', userName: 'Tester' })
    );
  });

  it('pins the key to a group the creator belongs to', async () => {
    await postApiKey(
      req({ body: { name: 'Claude', scopes: ['relationship:write'], groupId: 'g1' } }),
      mockRes()
    );

    expect(mockedCreate).toHaveBeenCalledWith(expect.objectContaining({ groupId: 'g1' }));
  });

  it('refuses to pin a key to a group the creator is not in', async () => {
    // Otherwise the pin could be used to reach into a group rather than to
    // restrict a key to one.
    const request = req({ body: { name: 'Claude', scopes: ['relationship:write'], groupId: 'g99' } });

    await expect(postApiKey(request, mockRes())).rejects.toMatchObject({ name: 'BadRequestError' });
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('passes an expiry through as a Date, and null when there is none', async () => {
    await postApiKey(
      req({ body: { name: 'A', scopes: ['relationship:read'], expiresAt: '2027-01-01T00:00:00.000Z' } }),
      mockRes()
    );
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({ expiresAt: new Date('2027-01-01T00:00:00.000Z') })
    );

    await postApiKey(req({ body: { name: 'B', scopes: ['relationship:read'] } }), mockRes());
    expect(mockedCreate).toHaveBeenLastCalledWith(expect.objectContaining({ expiresAt: null }));
  });
});

describe('postApiKeyReveal', () => {
  it('returns the token for the owner', async () => {
    mockedReveal.mockResolvedValue('tmb_live_abcdef123456_secret');
    const res = mockRes();

    await postApiKeyReveal(req({ params: { id: 'k1' } }), res);

    expect(mockedReveal).toHaveBeenCalledWith('u1', 'k1');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: { token: 'tmb_live_abcdef123456_secret' } })
    );
  });

  it('404s rather than revealing someone else’s key', async () => {
    mockedReveal.mockResolvedValue(null);
    await expect(postApiKeyReveal(req({ params: { id: 'k9' } }), mockRes())).rejects.toMatchObject({
      name: 'NotFoundError'
    });
  });
});

describe('postApiKeyRevoke', () => {
  it('revokes the caller’s key', async () => {
    mockedRevoke.mockResolvedValue(summary);
    await postApiKeyRevoke(req({ params: { id: 'k1' } }), mockRes());
    expect(mockedRevoke).toHaveBeenCalledWith('u1', 'k1');
  });

  it('404s for a key that is not the caller’s', async () => {
    mockedRevoke.mockResolvedValue(null);
    await expect(postApiKeyRevoke(req({ params: { id: 'k9' } }), mockRes())).rejects.toMatchObject({
      name: 'NotFoundError'
    });
  });
});

describe('removeApiKey', () => {
  it('deletes the caller’s key', async () => {
    mockedDelete.mockResolvedValue(true);
    const res = mockRes();

    await removeApiKey(req({ params: { id: 'k1' } }), res);

    expect(mockedDelete).toHaveBeenCalledWith('u1', 'k1');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { id: 'k1' } }));
  });

  it('404s when there was nothing to delete', async () => {
    mockedDelete.mockResolvedValue(false);
    await expect(removeApiKey(req({ params: { id: 'k9' } }), mockRes())).rejects.toMatchObject({
      name: 'NotFoundError'
    });
  });
});

describe('requireApiKeysConfigured', () => {
  const ORIGINAL = process.env.API_KEY_ENCRYPTION_SECRET;
  afterEach(() => {
    process.env.API_KEY_ENCRYPTION_SECRET = ORIGINAL;
  });

  it('lets requests through when the encryption secret is set', () => {
    process.env.API_KEY_ENCRYPTION_SECRET = 'configured';
    const next = jest.fn();

    requireApiKeysConfigured(req(), mockRes(), next);

    expect(next).toHaveBeenCalled();
  });

  it('names the missing variable instead of failing as an opaque 500', () => {
    delete process.env.API_KEY_ENCRYPTION_SECRET;
    const res = mockRes();
    const next = jest.fn();

    requireApiKeysConfigured(req(), res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('API_KEY_ENCRYPTION_SECRET') })
    );
    expect(next).not.toHaveBeenCalled();
  });
});
