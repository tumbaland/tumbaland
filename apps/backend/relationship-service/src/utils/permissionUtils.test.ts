import { buildAccessQuery, canAccessResource } from './permissionUtils';

describe('buildAccessQuery', () => {
  it('always includes the user\'s own resources', () => {
    expect(buildAccessQuery('user-1')).toEqual({ $or: [{ userId: 'user-1' }] });
  });

  it('adds a group-membership condition when groupIds are provided', () => {
    expect(buildAccessQuery('user-1', ['g1', 'g2'])).toEqual({
      $or: [{ userId: 'user-1' }, { groupId: { $in: ['g1', 'g2'] } }]
    });
  });

  it('adds a public-resource condition when includePublic is true', () => {
    expect(buildAccessQuery('user-1', [], true)).toEqual({
      $or: [{ userId: 'user-1' }, { isPublic: true }]
    });
  });

  it('combines group and public conditions', () => {
    expect(buildAccessQuery('user-1', ['g1'], true)).toEqual({
      $or: [{ userId: 'user-1' }, { groupId: { $in: ['g1'] } }, { isPublic: true }]
    });
  });
});

describe('canAccessResource', () => {
  it('allows the owner', () => {
    expect(canAccessResource('user-1', 'user-1')).toBe(true);
  });

  it('allows anyone when the resource is public', () => {
    expect(canAccessResource('user-1', 'user-2', undefined, [], true)).toBe(true);
  });

  it('allows a member of the resource\'s group', () => {
    expect(canAccessResource('user-1', 'user-2', 'g1', ['g1'])).toBe(true);
  });

  it('denies a non-member with no public flag', () => {
    expect(canAccessResource('user-1', 'user-2', 'g1', ['g2'])).toBe(false);
  });

  it('denies when the resource has no group and belongs to someone else', () => {
    expect(canAccessResource('user-1', 'user-2')).toBe(false);
  });
});
