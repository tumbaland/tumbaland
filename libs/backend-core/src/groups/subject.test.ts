jest.mock('../logging/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), http: jest.fn() }
}));

import { Request } from 'express';
import logger from '../logging/logger';
import { clearGroupOwnerCache } from './client';
import { groupOwnerSubject } from './subject';

const ORIGINAL_ENV = process.env;
const ORIGINAL_FETCH = global.fetch;

function ownerResponse(ownerEmail = 'owner@example.com'): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, groupId: 'group-1', ownerEmail, memberCount: 2, deleted: false })
  } as Response;
}

const request = (overrides: Partial<Request> = {}) =>
  ({ user: { id: '1', email: 'member@example.com', name: 'Member' }, originalUrl: '/api/photos', ...overrides }) as Request;

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    GROUP_API_URL: 'http://group-service:5006',
    INTERNAL_SERVICE_TOKEN: 'test-internal-token'
  };
  clearGroupOwnerCache();
  global.fetch = jest.fn();
  (logger.error as jest.Mock).mockClear();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
  global.fetch = ORIGINAL_FETCH;
});

describe('groupOwnerSubject', () => {
  it('bills a group resource to the group owner, not the uploader', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(ownerResponse());

    const subject = groupOwnerSubject(() => 'group-1');

    expect(await subject(request())).toBe('owner@example.com');
  });

  it('bills a personal resource to the caller and never asks group-service', async () => {
    const subject = groupOwnerSubject(() => undefined);

    expect(await subject(request())).toBe('member@example.com');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('accepts an async group-id resolver', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(ownerResponse());

    const subject = groupOwnerSubject(async () => 'group-1');

    expect(await subject(request())).toBe('owner@example.com');
  });

  it('falls back to the caller and logs when the owner cannot be resolved', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));

    const subject = groupOwnerSubject(() => 'group-1');

    // Billing the caller checks the write against their own — typically
    // smaller — allowance rather than refusing it outright, matching how the
    // entitlement client degrades for the same class of outage.
    expect(await subject(request())).toBe('member@example.com');
    expect(logger.error).toHaveBeenCalledWith(
      'Group owner unresolved; billing usage to the caller instead',
      expect.objectContaining({ groupId: 'group-1', caller: 'member@example.com' })
    );
  });

  it('returns undefined when there is no caller and no resolvable group, so the middleware 401s', async () => {
    const subject = groupOwnerSubject(() => undefined);

    expect(await subject(request({ user: undefined }))).toBeUndefined();
  });
});
