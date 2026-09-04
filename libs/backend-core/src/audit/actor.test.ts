import type { Request } from 'express';
import { actorOf, describeActor } from './actor';
import { PERSONAL_TENANT } from '../apiKeys/types';

const req = (over: Partial<Request> = {}): Request =>
  ({ query: {}, body: {}, headers: {}, ...over }) as unknown as Request;

const grant = { allowed: [PERSONAL_TENANT], default: PERSONAL_TENANT };

describe('actorOf', () => {
  it('reads a session as the person themselves', () => {
    const actor = actorOf(req({ user: { id: 'u1', email: 'tom@example.com', name: 'Tom' } }));

    expect(actor).toMatchObject({ kind: 'person', userId: 'u1', label: 'Tom' });
    // Nothing to revoke and nothing that rotates: a person is not a credential.
    expect(actor?.credentialId).toBeUndefined();
  });

  it('falls back to the email when a session carries no name', () => {
    // An unlabelled row is the one nobody can act on.
    const actor = actorOf(req({ user: { id: 'u1', email: 'tom@example.com', name: '' } }));
    expect(actor?.label).toBe('tom@example.com');
  });

  it('names an API key by what its owner called it', () => {
    const actor = actorOf(
      req({
        user: { id: 'u1', email: 'tom@example.com', name: 'Tom' },
        apiKey: {
          keyId: 'k1',
          scopes: [],
          tenants: grant,
          actingAs: PERSONAL_TENANT,
          kind: 'api_key',
          label: 'Claude Code',
          credentialId: 'k1'
        }
      })
    );

    expect(actor).toMatchObject({ kind: 'key', label: 'Claude Code', credentialId: 'k1' });
  });

  it('names a connected assistant by its client, not its token', () => {
    const actor = actorOf(
      req({
        user: { id: 'u1', email: 'tom@example.com', name: 'Tom' },
        apiKey: {
          keyId: 'client-1',
          scopes: [],
          tenants: { allowed: ['g1'], default: 'g1' },
          actingAs: 'g1',
          kind: 'oauth',
          label: 'Claude',
          credentialId: 'client-1'
        }
      })
    );

    // An access token's `jti` rotates hourly; a trail built on it would show a
    // different actor after every refresh.
    expect(actor).toMatchObject({ kind: 'assistant', label: 'Claude', credentialId: 'client-1' });
  });

  it('records the journal the request is acting in', () => {
    const actor = actorOf(
      req({
        user: { id: 'u1', email: 'a@b.c', name: 'Tom' },
        apiKey: {
          keyId: 'c1',
          scopes: [],
          tenants: { allowed: [PERSONAL_TENANT, 'g1'], default: 'g1' },
          actingAs: 'g1',
          kind: 'oauth',
          label: 'Claude',
          credentialId: 'c1'
        }
      })
    );

    expect(actor?.tenant).toBe('g1');
  });

  it('has nothing to attribute when nobody is authenticated', () => {
    // A row about the transport is not a row about anyone.
    expect(actorOf(req())).toBeNull();
  });

  it('describes software so it is not mistaken for a person', () => {
    expect(describeActor({ kind: 'person', userId: 'u1', label: 'Tom', tenant: PERSONAL_TENANT })).toBe('Tom');
    expect(
      describeActor({ kind: 'assistant', userId: 'u1', label: 'Claude', tenant: 'g1' })
    ).toBe('Claude (assistant)');
  });
});
