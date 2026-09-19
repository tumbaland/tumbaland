import { Response } from 'express';

jest.mock('../services/groupService', () => ({
  createGroup: jest.fn(),
  listMyGroups: jest.fn(),
  listMyDeletedGroups: jest.fn(),
  recordActivity: jest.fn(),
  getGroupIfMember: jest.fn(),
  updateGroup: jest.fn(),
  deleteGroup: jest.fn(),
  restoreGroup: jest.fn(),
  permanentlyDeleteGroup: jest.fn(),
  addMember: jest.fn(),
  updateMemberRole: jest.fn(),
  removeMember: jest.fn(),
  checkMembership: jest.fn()
}));

import * as svc from '../services/groupService';
import { InternalServiceRequest } from '../middleware/internalServiceAuth';
import {
  createGroup,
  listMine,
  listMyDeleted,
  getUserGroupIds,
  getOne,
  updateGroup,
  deleteGroup,
  restoreGroup,
  permanentlyDeleteGroup,
  addMember,
  updateRole,
  removeMember,
  membership
} from './groupController';

const mocked = svc as jest.Mocked<typeof svc>;

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res as Response;
}

const baseReq = (overrides: Partial<InternalServiceRequest> = {}) =>
  ({ user: { email: 'user@example.com' }, body: {}, params: {}, query: {}, ...overrides }) as InternalServiceRequest;

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
  delete process.env.AUTH_API_URL;
  delete process.env.INTERNAL_SERVICE_TOKEN;
});

describe('userEmail resolution (via createGroup)', () => {
  it('throws BadRequestError when there is no authenticated user and no internal service email', async () => {
    const res = mockRes();
    await expect(createGroup(baseReq({ user: undefined, body: { name: 'X' } }), res)).rejects.toMatchObject({
      name: 'BadRequestError'
    });
  });

  it('uses the authenticated user email for a normal request', async () => {
    mocked.createGroup.mockResolvedValue({ _id: 'g1' } as any);
    const res = mockRes();

    await createGroup(baseReq({ body: { name: 'Family' } }), res);

    expect(mocked.createGroup).toHaveBeenCalledWith('user@example.com', 'Family');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('uses the body userEmail for an internal service request', async () => {
    mocked.createGroup.mockResolvedValue({ _id: 'g1' } as any);
    const res = mockRes();

    await createGroup(
      baseReq({ user: undefined, isInternalService: true, body: { name: 'X', userEmail: 'svc@example.com' } }),
      res
    );

    expect(mocked.createGroup).toHaveBeenCalledWith('svc@example.com', 'X');
  });
});

describe('listMine', () => {
  it('records activity and returns the list', async () => {
    mocked.listMyGroups.mockResolvedValue([{ _id: 'g1' }, { _id: 'g2' }] as any);
    const res = mockRes();

    await listMine(baseReq(), res);

    expect(mocked.recordActivity).toHaveBeenCalledWith('user@example.com');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: [{ _id: 'g1' }, { _id: 'g2' }] }));
  });

  it('throws BadRequestError with no resolvable email', async () => {
    const res = mockRes();
    await expect(listMine(baseReq({ user: undefined }), res)).rejects.toMatchObject({ name: 'BadRequestError' });
  });
});

describe('listMyDeleted', () => {
  it('returns deleted groups', async () => {
    mocked.listMyDeletedGroups.mockResolvedValue([] as any);
    const res = mockRes();
    await listMyDeleted(baseReq(), res);
    expect(mocked.listMyDeletedGroups).toHaveBeenCalledWith('user@example.com');
  });

  it('throws BadRequestError with no resolvable email', async () => {
    const res = mockRes();
    await expect(listMyDeleted(baseReq({ user: undefined }), res)).rejects.toMatchObject({ name: 'BadRequestError' });
  });
});

describe('getUserGroupIds', () => {
  it('returns just the ids', async () => {
    mocked.listMyGroups.mockResolvedValue([{ _id: 'g1' }, { _id: 'g2' }] as any);
    const res = mockRes();

    await getUserGroupIds(baseReq(), res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: ['g1', 'g2'] }));
  });

  it('records activity for the person auth-service asks about', async () => {
    mocked.listMyGroups.mockResolvedValue([] as any);
    const res = mockRes();

    await getUserGroupIds(
      baseReq({ user: undefined, isInternalService: true, query: { userEmail: 'ada@example.com' } }),
      res
    );

    expect(mocked.recordActivity).toHaveBeenCalledWith('ada@example.com');
  });

  it('still returns the ids when recording activity fails', async () => {
    mocked.listMyGroups.mockResolvedValue([{ _id: 'g1' }] as any);
    mocked.recordActivity.mockRejectedValueOnce(new Error('db down'));
    const res = mockRes();

    await getUserGroupIds(baseReq(), res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: ['g1'] }));
  });

  it('throws BadRequestError with no resolvable email', async () => {
    const res = mockRes();
    await expect(getUserGroupIds(baseReq({ user: undefined }), res)).rejects.toMatchObject({
      name: 'BadRequestError'
    });
  });
});

describe('getOne', () => {
  it('returns the group', async () => {
    mocked.getGroupIfMember.mockResolvedValue({ _id: 'g1' } as any);
    const res = mockRes();

    await getOne(baseReq({ params: { id: 'g1' } }), res);

    expect(mocked.getGroupIfMember).toHaveBeenCalledWith('g1', 'user@example.com');
  });
});

describe('updateGroup', () => {
  it('updates the group name', async () => {
    mocked.updateGroup.mockResolvedValue({ _id: 'g1', name: 'New' } as any);
    const res = mockRes();

    await updateGroup(baseReq({ params: { id: 'g1' }, body: { name: 'New' } }), res);

    expect(mocked.updateGroup).toHaveBeenCalledWith('g1', 'user@example.com', { name: 'New' });
  });
});

describe('deleteGroup', () => {
  it('deletes and responds 204', async () => {
    mocked.deleteGroup.mockResolvedValue(undefined);
    const res = mockRes();

    await deleteGroup(baseReq({ params: { id: 'g1' } }), res);

    expect(res.status).toHaveBeenCalledWith(204);
  });
});

describe('restoreGroup', () => {
  it('restores the group', async () => {
    mocked.restoreGroup.mockResolvedValue({ _id: 'g1' } as any);
    const res = mockRes();

    await restoreGroup(baseReq({ params: { id: 'g1' } }), res);

    expect(mocked.restoreGroup).toHaveBeenCalledWith('g1', 'user@example.com');
  });
});

describe('permanentlyDeleteGroup', () => {
  it('permanently deletes and responds 204', async () => {
    mocked.permanentlyDeleteGroup.mockResolvedValue(undefined);
    const res = mockRes();

    await permanentlyDeleteGroup(baseReq({ params: { id: 'g1' } }), res);

    expect(res.status).toHaveBeenCalledWith(204);
  });
});

describe('addMember', () => {
  it('adds the member and invalidates their tokens when auth service is configured', async () => {
    process.env.AUTH_API_URL = 'https://auth.example';
    process.env.INTERNAL_SERVICE_TOKEN = 'test-token';
    mocked.addMember.mockResolvedValue({ _id: 'g1' } as any);
    const res = mockRes();

    await addMember(baseReq({ params: { id: 'g1' }, body: { email: 'new@example.com', role: 'member' } }), res);

    expect(mocked.addMember).toHaveBeenCalledWith('g1', 'user@example.com', 'new@example.com', 'member');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://auth.example/auth/internal/invalidate-tokens',
      expect.objectContaining({ method: 'POST' })
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('skips token invalidation (logs a warning) when auth service is not configured', async () => {
    mocked.addMember.mockResolvedValue({ _id: 'g1' } as any);
    const res = mockRes();

    await addMember(baseReq({ params: { id: 'g1' }, body: { email: 'new@example.com' } }), res);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('logs (does not throw) when the invalidate-tokens request responds not-ok', async () => {
    process.env.AUTH_API_URL = 'https://auth.example';
    process.env.INTERNAL_SERVICE_TOKEN = 'test-token';
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });
    mocked.addMember.mockResolvedValue({ _id: 'g1' } as any);
    const res = mockRes();

    await expect(addMember(baseReq({ params: { id: 'g1' }, body: { email: 'new@example.com' } }), res)).resolves.toBeUndefined();
  });

  it('logs (does not throw) when the invalidate-tokens request itself rejects', async () => {
    process.env.AUTH_API_URL = 'https://auth.example';
    process.env.INTERNAL_SERVICE_TOKEN = 'test-token';
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network down'));
    mocked.addMember.mockResolvedValue({ _id: 'g1' } as any);
    const res = mockRes();

    await expect(addMember(baseReq({ params: { id: 'g1' }, body: { email: 'new@example.com' } }), res)).resolves.toBeUndefined();
  });
});

describe('updateRole', () => {
  it('updates the role and invalidates the target user tokens', async () => {
    mocked.updateMemberRole.mockResolvedValue({ _id: 'g1' } as any);
    const res = mockRes();

    await updateRole(baseReq({ params: { id: 'g1', memberEmail: 'member@example.com' }, body: { role: 'admin' } }), res);

    expect(mocked.updateMemberRole).toHaveBeenCalledWith('g1', 'user@example.com', 'member@example.com', 'admin');
  });
});

describe('removeMember', () => {
  it('removes the member and invalidates their tokens', async () => {
    mocked.removeMember.mockResolvedValue({ _id: 'g1' } as any);
    const res = mockRes();

    await removeMember(baseReq({ params: { id: 'g1', memberEmail: 'member@example.com' } }), res);

    expect(mocked.removeMember).toHaveBeenCalledWith('g1', 'user@example.com', 'member@example.com');
  });
});

describe('membership', () => {
  it('returns the membership status', async () => {
    mocked.checkMembership.mockResolvedValue({ member: true, role: 'owner' });
    const res = mockRes();

    await membership(baseReq({ params: { id: 'g1' } }), res);

    expect(res.json).toHaveBeenCalledWith({ success: true, member: true, role: 'owner' });
  });
});
