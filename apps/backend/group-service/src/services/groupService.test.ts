jest.mock('../models/Group', () => ({
  Group: {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findByIdAndDelete: jest.fn(),
    updateOne: jest.fn()
  }
}));

import { Group } from '../models/Group';
import * as groupService from './groupService';

const mockedCreate = Group.create as unknown as jest.Mock;
const mockedFind = Group.find as unknown as jest.Mock;
const mockedFindOne = Group.findOne as unknown as jest.Mock;
const mockedFindByIdAndDelete = Group.findByIdAndDelete as unknown as jest.Mock;
const mockedUpdateOne = Group.updateOne as unknown as jest.Mock;

function makeGroup(overrides: Partial<{ members: any[]; deletedAt: Date | null }> = {}) {
  return {
    _id: 'group-1',
    name: 'Family',
    members: overrides.members ?? [{ email: 'owner@example.com', role: 'owner' }],
    deletedAt: overrides.deletedAt,
    save: jest.fn().mockResolvedValue(undefined)
  } as any;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createGroup', () => {
  it('creates the group with the creator as owner', async () => {
    mockedCreate.mockResolvedValue({ _id: 'group-1' });

    await groupService.createGroup('Creator@Example.com', '  Family  ');

    expect(mockedCreate).toHaveBeenCalledWith({
      name: 'Family',
      createdBy: 'creator@example.com',
      members: [{ email: 'creator@example.com', role: 'owner', joinedAt: expect.any(Date) }]
    });
  });
});

describe('listMyGroups', () => {
  it('queries by lowercased member email, excluding soft-deleted groups', async () => {
    const sortFn = jest.fn().mockResolvedValue([{ _id: 'group-1' }]);
    mockedFind.mockReturnValue({ sort: sortFn });

    const result = await groupService.listMyGroups('User@Example.com');

    expect(result).toEqual([{ _id: 'group-1' }]);
    expect(mockedFind).toHaveBeenCalledWith({
      'members.email': 'user@example.com',
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }]
    });
    expect(sortFn).toHaveBeenCalledWith({ updatedAt: -1 });
  });
});

describe('getGroupIfMember', () => {
  it('throws NotFoundError when the group does not exist', async () => {
    mockedFindOne.mockResolvedValue(null);

    await expect(groupService.getGroupIfMember('group-1', 'user@example.com')).rejects.toMatchObject({
      name: 'NotFoundError'
    });
  });

  it('throws ForbiddenError when the caller is not a member', async () => {
    mockedFindOne.mockResolvedValue(makeGroup());

    await expect(groupService.getGroupIfMember('group-1', 'outsider@example.com')).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
  });

  it('returns the group for a member', async () => {
    const group = makeGroup();
    mockedFindOne.mockResolvedValue(group);

    const result = await groupService.getGroupIfMember('group-1', 'OWNER@example.com');

    expect(result).toBe(group);
  });
});

describe('updateGroup', () => {
  it('rejects a plain member trying to rename the group', async () => {
    mockedFindOne.mockResolvedValue(makeGroup({ members: [{ email: 'member@example.com', role: 'member' }] }));

    await expect(groupService.updateGroup('group-1', 'member@example.com', { name: 'New name' })).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
  });

  it('allows an admin to rename the group', async () => {
    const group = makeGroup({ members: [{ email: 'admin@example.com', role: 'admin' }] });
    mockedFindOne.mockResolvedValue(group);

    const result = await groupService.updateGroup('group-1', 'admin@example.com', { name: '  New name  ' });

    expect(result.name).toBe('New name');
    expect(group.save).toHaveBeenCalledTimes(1);
  });
});

describe('deleteGroup', () => {
  it('rejects a non-owner', async () => {
    mockedFindOne.mockResolvedValue(makeGroup({ members: [{ email: 'admin@example.com', role: 'admin' }] }));

    await expect(groupService.deleteGroup('group-1', 'admin@example.com')).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
  });

  it('soft-deletes the group for the owner', async () => {
    const group = makeGroup();
    mockedFindOne.mockResolvedValue(group);

    await groupService.deleteGroup('group-1', 'owner@example.com');

    expect(group.deletedAt).toBeInstanceOf(Date);
    expect(group.save).toHaveBeenCalledTimes(1);
    expect(mockedFindByIdAndDelete).not.toHaveBeenCalled();
  });
});

describe('addMember', () => {
  it('rejects a plain member from adding others', async () => {
    mockedFindOne.mockResolvedValue(makeGroup({ members: [{ email: 'member@example.com', role: 'member' }] }));

    await expect(groupService.addMember('group-1', 'member@example.com', 'new@example.com')).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
  });

  it('rejects adding a user who is already a member', async () => {
    mockedFindOne.mockResolvedValue(
      makeGroup({ members: [{ email: 'owner@example.com', role: 'owner' }, { email: 'existing@example.com', role: 'member' }] })
    );

    await expect(groupService.addMember('group-1', 'owner@example.com', 'Existing@example.com')).rejects.toMatchObject({
      name: 'ConflictError'
    });
  });

  it('adds a new member as owner/admin', async () => {
    const group = makeGroup();
    mockedFindOne.mockResolvedValue(group);

    const result = await groupService.addMember('group-1', 'owner@example.com', 'New@Example.com', 'admin');

    expect(result.members).toContainEqual(expect.objectContaining({ email: 'new@example.com', role: 'admin' }));
    expect(group.save).toHaveBeenCalledTimes(1);
  });
});

describe('updateMemberRole', () => {
  it('throws NotFoundError when the target member does not exist in the group', async () => {
    mockedFindOne.mockResolvedValue(makeGroup());

    await expect(groupService.updateMemberRole('group-1', 'owner@example.com', 'ghost@example.com', 'admin')).rejects.toMatchObject({
      name: 'NotFoundError'
    });
  });

  it('updates the role for an existing member', async () => {
    const group = makeGroup({
      members: [{ email: 'owner@example.com', role: 'owner' }, { email: 'member@example.com', role: 'member' }]
    });
    mockedFindOne.mockResolvedValue(group);

    const result = await groupService.updateMemberRole('group-1', 'owner@example.com', 'member@example.com', 'admin');

    expect(result.members.find((m: any) => m.email === 'member@example.com')?.role).toBe('admin');
    expect(group.save).toHaveBeenCalledTimes(1);
  });
});

describe('removeMember', () => {
  it('allows a plain member to remove themselves', async () => {
    const group = makeGroup({
      members: [{ email: 'owner@example.com', role: 'owner' }, { email: 'member@example.com', role: 'member' }]
    });
    mockedFindOne.mockResolvedValue(group);

    const result = await groupService.removeMember('group-1', 'member@example.com', 'member@example.com');

    expect(result.members.some((m: any) => m.email === 'member@example.com')).toBe(false);
  });

  it('rejects a plain member removing someone else', async () => {
    mockedFindOne.mockResolvedValue(
      makeGroup({ members: [{ email: 'owner@example.com', role: 'owner' }, { email: 'member@example.com', role: 'member' }] })
    );

    await expect(groupService.removeMember('group-1', 'member@example.com', 'owner@example.com')).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
  });

  it('allows an admin to remove another member', async () => {
    const group = makeGroup({
      members: [{ email: 'admin@example.com', role: 'admin' }, { email: 'member@example.com', role: 'member' }]
    });
    mockedFindOne.mockResolvedValue(group);

    const result = await groupService.removeMember('group-1', 'admin@example.com', 'member@example.com');

    expect(result.members.some((m: any) => m.email === 'member@example.com')).toBe(false);
  });
});

describe('checkMembership', () => {
  it('reports non-membership for an outsider', async () => {
    mockedFindOne.mockResolvedValue(makeGroup());

    const result = await groupService.checkMembership('group-1', 'outsider@example.com');

    expect(result).toEqual({ member: false, role: null });
  });

  it('reports the role for an existing member', async () => {
    mockedFindOne.mockResolvedValue(makeGroup());

    const result = await groupService.checkMembership('group-1', 'OWNER@example.com');

    expect(result).toEqual({ member: true, role: 'owner' });
  });
});

describe('updateMemberActivity', () => {
  it('sets lastActivity for the matching member using a lowercased email', async () => {
    mockedUpdateOne.mockResolvedValue({});

    await groupService.updateMemberActivity('group-1', 'Member@Example.com');

    expect(mockedUpdateOne).toHaveBeenCalledWith(
      { _id: 'group-1', 'members.email': 'member@example.com' },
      { $set: { 'members.$.lastActivity': expect.any(Date) } }
    );
  });
});

describe('listMyDeletedGroups', () => {
  it('queries soft-deleted groups for the member, sorted by deletedAt desc', async () => {
    const sort = jest.fn().mockResolvedValue([]);
    mockedFind.mockReturnValue({ sort });

    await groupService.listMyDeletedGroups('Owner@Example.com');

    expect(mockedFind).toHaveBeenCalledWith({
      'members.email': 'owner@example.com',
      deletedAt: { $exists: true }
    });
    expect(sort).toHaveBeenCalledWith({ deletedAt: -1 });
  });
});

describe('restoreGroup', () => {
  it('throws NotFoundError when no soft-deleted group matches', async () => {
    mockedFindOne.mockResolvedValue(null);
    await expect(groupService.restoreGroup('group-1', 'owner@example.com')).rejects.toMatchObject({
      name: 'NotFoundError'
    });
  });

  it('rejects a non-owner', async () => {
    mockedFindOne.mockResolvedValue(makeGroup({ members: [{ email: 'admin@example.com', role: 'admin' }] }));
    await expect(groupService.restoreGroup('group-1', 'admin@example.com')).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
  });

  it('clears deletedAt for the owner', async () => {
    const group = makeGroup({ deletedAt: new Date() });
    mockedFindOne.mockResolvedValue(group);

    const result = await groupService.restoreGroup('group-1', 'owner@example.com');

    expect(group.deletedAt).toBeUndefined();
    expect(group.save).toHaveBeenCalledTimes(1);
    expect(result).toBe(group);
  });
});

describe('permanentlyDeleteGroup', () => {
  it('throws NotFoundError when no soft-deleted group matches', async () => {
    mockedFindOne.mockResolvedValue(null);
    await expect(groupService.permanentlyDeleteGroup('group-1', 'owner@example.com')).rejects.toMatchObject({
      name: 'NotFoundError'
    });
  });

  it('rejects a non-owner', async () => {
    mockedFindOne.mockResolvedValue(makeGroup({ members: [{ email: 'admin@example.com', role: 'admin' }] }));
    await expect(groupService.permanentlyDeleteGroup('group-1', 'admin@example.com')).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
  });

  it('permanently deletes the group for the owner', async () => {
    mockedFindOne.mockResolvedValue(makeGroup());
    mockedFindByIdAndDelete.mockResolvedValue({});

    await groupService.permanentlyDeleteGroup('group-1', 'owner@example.com');

    expect(mockedFindByIdAndDelete).toHaveBeenCalledWith('group-1');
  });
});
