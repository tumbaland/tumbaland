import { buildAccessQuery, canAccessResource } from './permissionUtils';

describe('buildAccessQuery', () => {
  it('always includes the userId condition', () => {
    expect(buildAccessQuery('user-1')).toEqual({ $or: [{ userId: 'user-1' }] });
  });

  it('adds a group condition when groupIds is non-empty', () => {
    expect(buildAccessQuery('user-1', ['g1'])).toEqual({ $or: [{ userId: 'user-1' }, { groupId: { $in: ['g1'] } }] });
  });

  it('adds an isPublic condition when includePublic is true', () => {
    expect(buildAccessQuery('user-1', [], true)).toEqual({ $or: [{ userId: 'user-1' }, { isPublic: true }] });
  });
});

describe('canAccessResource', () => {
  it('allows the owner', () => {
    expect(canAccessResource('u1', 'u1')).toBe(true);
  });

  it('allows anyone when the resource is public', () => {
    expect(canAccessResource('u1', 'u2', undefined, [], true)).toBe(true);
  });

  it('allows a group member when the resource belongs to their group', () => {
    expect(canAccessResource('u1', 'u2', 'g1', ['g1'])).toBe(true);
  });

  it('denies a non-member, non-owner, non-public resource', () => {
    expect(canAccessResource('u1', 'u2', 'g1', ['g2'])).toBe(false);
  });
});
