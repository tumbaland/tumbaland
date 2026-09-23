import { Response } from 'express';

jest.mock('../services/groupService', () => ({
  createGroup: jest.fn(),
  listMyGroups: jest.fn(),
  listMyDeletedGroups: jest.fn(),
  withMemberActivity: jest.fn(async (groups: unknown[]) => groups),
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
  delete process.env.AUTH_INTERNAL_URL;
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
    mocked.createGroup.mockResolvedValue({ _id: 'g1' } as never);
    const res = mockRes();

    await createGroup(baseReq({ body: { name: 'Family' } }), res);

    expect(mocked.createGroup).toHaveBeenCalledWith('user@example.com', 'Family');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('uses the body userEmail for an internal service request', async () => {
    mocked.createGroup.mockResolvedValue({ _id: 'g1' } as never);
    const res = mockRes();

    await createGroup(
      baseReq({ user: undefined, isInternalService: true, body: { name: 'X', userEmail: 'svc@example.com' } }),
      res
    );

    expect(mocked.createGroup).toHaveBeenCalledWith('svc@example.com', 'X');
  });
});

describe('listMine', () => {
  it('returns the list with each member’s activity filled in', async () => {
    mocked.listMyGroups.mockResolvedValue([{ _id: 'g1' }, { _id: 'g2' }] as never);
    const res = mockRes();

    await listMine(baseReq(), res);

    expect(mocked.withMemberActivity).toHaveBeenCalledWith([{ _id: 'g1' }, { _id: 'g2' }]);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: [{ _id: 'g1' }, { _id: 'g2' }] }));
  });

  it('throws BadRequestError with no resolvable email', async () => {
    const res = mockRes();
    await expect(listMine(baseReq({ user: undefined }), res)).rejects.toMatchObject({ name: 'BadRequestError' });
  });
});

describe('listMyDeleted', () => {
  it('returns deleted groups', async () => {
    mocked.listMyDeletedGroups.mockResolvedValue([] as never);
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
    mocked.listMyGroups.mockResolvedValue([{ _id: 'g1' }, { _id: 'g2' }] as never);
    const res = mockRes();

    await getUserGroupIds(baseReq(), res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: ['g1', 'g2'] }));
  });

  it('is a pure read: every service asks it, so it must not write', async () => {
    mocked.listMyGroups.mockResolvedValue([{ _id: 'g1' }] as never);
    const res = mockRes();

    await getUserGroupIds(
      baseReq({ user: undefined, isInternalService: true, query: { userEmail: 'ada@example.com' } }),
      res
    );

    expect(mocked.listMyGroups).toHaveBeenCalledWith('ada@example.com');
    expect(mocked.withMemberActivity).not.toHaveBeenCalled();
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
    mocked.getGroupIfMember.mockResolvedValue({ _id: 'g1' } as never);
    const res = mockRes();

    await getOne(baseReq({ params: { id: 'g1' } }), res);

    expect(mocked.getGroupIfMember).toHaveBeenCalledWith('g1', 'user@example.com');
    expect(mocked.withMemberActivity).toHaveBeenCalledWith([{ _id: 'g1' }]);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { _id: 'g1' } }));
  });
});

describe('updateGroup', () => {
  it('updates the group name', async () => {
    mocked.updateGroup.mockResolvedValue({ _id: 'g1', name: 'New' } as never);
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
    mocked.restoreGroup.mockResolvedValue({ _id: 'g1' } as never);
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
  it('adds the member without signing them out: nothing is sent to auth-service', async () => {
    process.env.AUTH_INTERNAL_URL = 'https://auth.example';
    process.env.INTERNAL_SERVICE_TOKEN = 'test-token';
    mocked.addMember.mockResolvedValue({ _id: 'g1' } as never);
    const res = mockRes();

    await addMember(baseReq({ params: { id: 'g1' }, body: { email: 'new@example.com', role: 'member' } }), res);

    expect(mocked.addMember).toHaveBeenCalledWith('g1', 'user@example.com', 'new@example.com', 'member');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('updateRole', () => {
  it('updates the role without signing the member out', async () => {
    mocked.updateMemberRole.mockResolvedValue({ _id: 'g1' } as never);
    const res = mockRes();

    await updateRole(baseReq({ params: { id: 'g1', memberEmail: 'member@example.com' }, body: { role: 'admin' } }), res);

    expect(mocked.updateMemberRole).toHaveBeenCalledWith('g1', 'user@example.com', 'member@example.com', 'admin');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('removeMember', () => {
  it('removes the member without a token invalidation; their access ends through the membership lookup', async () => {
    mocked.removeMember.mockResolvedValue({ _id: 'g1' } as never);
    const res = mockRes();

    await removeMember(baseReq({ params: { id: 'g1', memberEmail: 'member@example.com' } }), res);

    expect(mocked.removeMember).toHaveBeenCalledWith('g1', 'user@example.com', 'member@example.com');
    expect(global.fetch).not.toHaveBeenCalled();
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
