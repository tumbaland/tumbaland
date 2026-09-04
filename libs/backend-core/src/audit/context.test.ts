import type { Request, Response } from 'express';

jest.mock('./reads', () => ({ recordRead: jest.fn() }));

import { recordRead } from './reads';
import { beginAudit, currentAuditContext, withAuditContext } from './context';
import { PERSONAL_TENANT } from '../apiKeys/types';

const ORIGINAL_ENV = process.env;

const req = (over: Partial<Request> = {}): Request =>
  ({ method: 'GET', query: {}, body: {}, baseUrl: '', path: '/', ...over }) as unknown as Request;

const res = () => ({ on: jest.fn(), locals: {} }) as unknown as Response;
const user = { id: 'u1', email: 'tom@example.com', name: 'Tom' };

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe('beginAudit', () => {
  it('puts the actor in scope for everything after it', () => {
    let seen: string | undefined;
    beginAudit(req({ user }), res(), () => {
      seen = currentAuditContext()?.actor.label;
    });

    expect(seen).toBe('Tom');
  });

  it('leaves no context behind once the request is done', () => {
    beginAudit(req({ user }), res(), () => undefined);
    // A leaked context would attribute the next request — or a background job —
    // to whoever happened to come before it.
    expect(currentAuditContext()).toBeUndefined();
  });

  it('continues without a context when nobody is authenticated', () => {
    const next = jest.fn();
    beginAudit(req(), res(), next);

    expect(next).toHaveBeenCalled();
    expect(recordRead).not.toHaveBeenCalled();
  });

  it('arms the read trail for the same request', () => {
    beginAudit(req({ user }), res(), () => undefined);
    expect(recordRead).toHaveBeenCalled();
  });
});

describe('naming the service', () => {
  it('uses SERVICE_NAME, as metrics and health already do', () => {
    process.env.SERVICE_NAME = 'album-service';
    let seen: string | undefined;

    beginAudit(req({ user }), res(), () => {
      seen = currentAuditContext()?.service;
    });

    expect(seen).toBe('album-service');
  });

  it('falls back to the package name, so local development is still labelled', () => {
    // Nothing sets SERVICE_NAME in dev, and every row landing under one
    // meaningless label makes the UI's area filter look broken.
    delete process.env.SERVICE_NAME;
    process.env.npm_package_name = 'finance-service';
    let seen: string | undefined;

    beginAudit(req({ user }), res(), () => {
      seen = currentAuditContext()?.service;
    });

    expect(seen).toBe('finance-service');
  });
});

describe('withAuditContext', () => {
  it('runs work as an explicit actor, for jobs and tests', () => {
    const actor = { kind: 'person' as const, userId: 'u1', label: 'Tom', tenant: PERSONAL_TENANT };
    const seen = withAuditContext({ actor, service: 'test' }, () => currentAuditContext());

    expect(seen?.actor.label).toBe('Tom');
  });
});
