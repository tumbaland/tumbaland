import type { Request, Response } from 'express';

jest.mock('./AuditEvent', () => ({ AuditEvent: { create: jest.fn().mockResolvedValue({}) } }));
jest.mock('../logging/logger', () => ({
  __esModule: true,
  default: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

import { AuditEvent } from './AuditEvent';
import { auditReads, countRead, resourceOf } from './reads';
import { PERSONAL_TENANT } from '../apiKeys/types';

const created = AuditEvent.create as jest.Mock;

/** A response that runs its finish listeners when told to. */
function mockRes(statusCode = 200) {
  const listeners: (() => void)[] = [];
  const res = {
    statusCode,
    locals: {} as Record<string, unknown>,
    on: (event: string, fn: () => void) => {
      if (event === 'finish') listeners.push(fn);
      return res;
    },
    finish: () => listeners.forEach((fn) => fn())
  };
  return res as unknown as Response & { finish: () => void };
}

const req = (over: Partial<Request> = {}): Request =>
  ({ method: 'GET', baseUrl: '/api/activities', path: '/', query: {}, ...over }) as unknown as Request;

const assistant = {
  keyId: 'client-1',
  scopes: [],
  tenants: { allowed: ['g1'], default: 'g1' },
  actingAs: 'g1',
  kind: 'oauth' as const,
  label: 'Claude',
  credentialId: 'client-1'
};

const user = { id: 'u1', email: 'tom@example.com', name: 'Tom' };

beforeEach(() => jest.clearAllMocks());

describe('auditReads', () => {
  it('records what an assistant read', async () => {
    const res = mockRes();
    const request = req({ user, apiKey: assistant });

    auditReads('relationship-service')(request, res, jest.fn());
    countRead(res, 47);
    res.finish();

    expect(created).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'read',
        resource: 'activities',
        actorKind: 'assistant',
        actorLabel: 'Claude',
        tenant: 'g1',
        // The size of what left the server is most of what makes a read worth
        // keeping: "read the journal" and "read 47 entries" are different events.
        count: 47
      })
    );
  });

  it('records nothing for a person browsing their own journal', async () => {
    // One dashboard load hits half a dozen endpoints. Logging those would bury
    // the interesting rows and put a database write behind every page view.
    const res = mockRes();

    auditReads('relationship-service')(req({ user }), res, jest.fn());
    res.finish();

    expect(created).not.toHaveBeenCalled();
  });

  it('records nothing for a write, which the model plugin already covers', () => {
    const res = mockRes();
    auditReads('relationship-service')(req({ user, apiKey: assistant, method: 'POST' }), res, jest.fn());
    res.finish();

    expect(created).not.toHaveBeenCalled();
  });

  it('records nothing for a refused request', () => {
    // A 403 is not a read: nothing left the server.
    const res = mockRes(403);
    auditReads('relationship-service')(req({ user, apiKey: assistant }), res, jest.fn());
    res.finish();

    expect(created).not.toHaveBeenCalled();
  });

  it('always continues the request, whether or not it recorded anything', () => {
    const next = jest.fn();
    auditReads('relationship-service')(req(), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('does not fail the request when the trail cannot be written', async () => {
    created.mockRejectedValueOnce(new Error('audit db down'));
    const res = mockRes();

    auditReads('relationship-service')(req({ user, apiKey: assistant }), res, jest.fn());
    expect(() => res.finish()).not.toThrow();
  });

  it('survives a handler that never counted anything', () => {
    const res = mockRes();
    auditReads('relationship-service')(req({ user, apiKey: assistant }), res, jest.fn());
    res.finish();

    expect(created).toHaveBeenCalledWith(expect.objectContaining({ count: undefined }));
  });
});

describe('resourceOf', () => {
  it.each([
    ['/api/activities/', 'activities'],
    ['/api/activities/68d6d7edfb26c947ecaa057a', 'activities'],
    ['/api/activity-types/', 'activity_types'],
    ['/api/statistics/trends', 'statistics']
  ])('reads %s as %s', (path, expected) => {
    // Deliberately crude: a trail naming the resource is readable, and one
    // naming the full path with ids in it is a request log in disguise.
    expect(resourceOf(path)).toBe(expected);
  });

  it('names something rather than nothing for an unrecognisable path', () => {
    expect(resourceOf('/')).toBe('unknown');
  });
});

describe('countRead', () => {
  it('cannot break the request it is instrumenting', () => {
    // Express always provides `locals`; a handler called directly does not.
    expect(() => countRead({} as Response, 3)).not.toThrow();
    expect(() => countRead(undefined as unknown as Response, 3)).not.toThrow();
  });

  it('leaves the count where the middleware will find it', () => {
    const res = { locals: {} } as Response;
    countRead(res, 12);
    expect(res.locals.auditCount).toBe(12);
  });
});

describe('PERSONAL_TENANT', () => {
  it('is what a personal-tenant read is recorded against', () => {
    const res = mockRes();
    auditReads('relationship-service')(
      req({ user, apiKey: { ...assistant, actingAs: PERSONAL_TENANT } }),
      res,
      jest.fn()
    );
    res.finish();

    expect(created).toHaveBeenCalledWith(expect.objectContaining({ tenant: PERSONAL_TENANT }));
  });
});
