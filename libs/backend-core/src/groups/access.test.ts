import { ForbiddenError } from '../errors/HttpError';
import { assertMemberOf, isMemberOf } from './access';

describe('isMemberOf', () => {
  it('is true for a group the person is in, false for any other', () => {
    expect(isMemberOf('g1', ['g1', 'g2'])).toBe(true);
    expect(isMemberOf('g3', ['g1', 'g2'])).toBe(false);
  });

  it('is false when the person is in no groups, however that is spelled', () => {
    expect(isMemberOf('g1', [])).toBe(false);
    expect(isMemberOf('g1', undefined)).toBe(false);
    expect(isMemberOf('g1', null)).toBe(false);
  });
});

describe('assertMemberOf', () => {
  it('lets a group the person is in through', () => {
    expect(() => assertMemberOf('g1', ['g1'])).not.toThrow();
  });

  it('lets personal data through: no group named is always the caller’s own', () => {
    expect(() => assertMemberOf(undefined, [])).not.toThrow();
    expect(() => assertMemberOf(null, ['g1'])).not.toThrow();
    expect(() => assertMemberOf('', ['g1'])).not.toThrow();
  });

  it('refuses a group the person is not in, with a 403', () => {
    expect(() => assertMemberOf('g9', ['g1'])).toThrow(ForbiddenError);
    expect(() => assertMemberOf('g9', ['g1'])).toThrow('Access denied');
  });

  it('refuses any group at all when the person has none', () => {
    expect(() => assertMemberOf('g1', undefined)).toThrow(ForbiddenError);
  });

  it('says what it is told to say', () => {
    expect(() => assertMemberOf('g9', [], 'Not a member of this group')).toThrow('Not a member of this group');
  });
});
