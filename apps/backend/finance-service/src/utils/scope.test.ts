import { Request } from 'express';
import { ForbiddenError } from '@tumbaland/backend-core';
import { contextGroupId, contextGroups } from './scope';

const request = (query: Record<string, unknown>, userGroups?: string[]): Request =>
  ({ query, userGroups }) as unknown as Request;

describe('contextGroupId', () => {
  it('is undefined without a groupId, meaning personal data', () => {
    expect(contextGroupId(request({}, ['g1']))).toBeUndefined();
    expect(contextGroupId(request({ groupId: '' }, ['g1']))).toBeUndefined();
  });

  it('returns a group the caller belongs to', () => {
    expect(contextGroupId(request({ groupId: 'g1' }, ['g1', 'g2']))).toBe('g1');
  });

  it('refuses a group the caller is not in rather than reading it as personal', () => {
    expect(() => contextGroupId(request({ groupId: 'g3' }, ['g1']))).toThrow(ForbiddenError);
    expect(() => contextGroupId(request({ groupId: 'g1' }))).toThrow(ForbiddenError);
  });

  it('refuses a repeated query parameter', () => {
    expect(() => contextGroupId(request({ groupId: ['g1', 'g2'] }, ['g1', 'g2']))).toThrow(ForbiddenError);
  });

  it('checks a value the caller passes instead of the query', () => {
    expect(contextGroupId(request({}, ['g1']), 'g1')).toBe('g1');
    expect(() => contextGroupId(request({ groupId: 'g1' }, ['g1']), 'g2')).toThrow(ForbiddenError);
  });
});

describe('contextGroups', () => {
  it('is the checked group as a list, or empty for personal', () => {
    expect(contextGroups(request({ groupId: 'g1' }, ['g1']))).toEqual(['g1']);
    expect(contextGroups(request({}, ['g1']))).toEqual([]);
  });
});
