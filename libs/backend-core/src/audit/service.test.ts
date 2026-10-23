import os from 'os';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { AuditEvent } from './AuditEvent';
import { listAuditEvents } from './service';

let mongo: MongoMemoryServer;

const event = (over: Record<string, unknown> = {}) => ({
  at: new Date('2026-09-05T10:00:00Z'),
  service: 'relationship-service',
  action: 'create' as const,
  resource: 'activity',
  actorKind: 'assistant' as const,
  userId: 'u1',
  actorLabel: 'Claude',
  actorCredentialId: 'client-1',
  tenant: 'g1',
  ...over
});

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  // The driver loads `os` with a dynamic import, which Jest's sandbox refuses, so it is handed over.
  await mongoose.connect(mongo.getUri(), { runtimeAdapters: { os } });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(() => AuditEvent.deleteMany({}));

describe('listAuditEvents', () => {
  it('returns one account’s trail and never anyone else’s', async () => {
    await AuditEvent.insertMany([event(), event({ userId: 'u2', actorLabel: 'Someone else' })]);

    const { events, total } = await listAuditEvents({ userId: 'u1' });

    // Scoped by the query rather than filtered afterwards: the trail carries old
    // values of journal entries, so a wider read must not be one forgotten
    // condition away.
    expect(total).toBe(1);
    expect(events[0].actorLabel).toBe('Claude');
  });

  it('returns newest first, which is the only order anyone reads a trail in', async () => {
    await AuditEvent.insertMany([
      event({ at: new Date('2026-09-01T10:00:00Z'), resource: 'older' }),
      event({ at: new Date('2026-09-05T10:00:00Z'), resource: 'newer' })
    ]);

    const { events } = await listAuditEvents({ userId: 'u1' });
    expect(events.map((e) => e.resource)).toEqual(['newer', 'older']);
  });

  it('narrows to one assistant, which is the question people actually ask', async () => {
    await AuditEvent.insertMany([
      event({ actorCredentialId: 'client-1', actorLabel: 'Claude' }),
      event({ actorCredentialId: 'client-2', actorLabel: 'ChatGPT' })
    ]);

    const { events } = await listAuditEvents({ userId: 'u1', credentialId: 'client-1' });

    expect(events).toHaveLength(1);
    expect(events[0].actorLabel).toBe('Claude');
  });

  it('separates what software did from what a person did', async () => {
    await AuditEvent.insertMany([
      event({ actorKind: 'assistant' }),
      event({ actorKind: 'person', actorLabel: 'Tom' })
    ]);

    const { events } = await listAuditEvents({ userId: 'u1', actorKind: 'person' });
    expect(events.map((e) => e.actorLabel)).toEqual(['Tom']);
  });

  it('narrows by action and by date range', async () => {
    await AuditEvent.insertMany([
      event({ action: 'delete', at: new Date('2026-09-01T10:00:00Z') }),
      event({ action: 'delete', at: new Date('2026-09-05T10:00:00Z') }),
      event({ action: 'read', at: new Date('2026-09-05T11:00:00Z') })
    ]);

    const { events } = await listAuditEvents({
      userId: 'u1',
      action: 'delete',
      from: new Date('2026-09-03T00:00:00Z')
    });

    expect(events).toHaveLength(1);
    expect(events[0].at).toBe('2026-09-05T10:00:00.000Z');
  });

  it('hands back the change detail, which is the reason to look', async () => {
    await AuditEvent.insertMany([event({ action: 'update', changes: { hours: { from: 3, to: 2 } } })]);

    const { events } = await listAuditEvents({ userId: 'u1' });
    expect(events[0].changes).toEqual({ hours: { from: 3, to: 2 } });
  });

  it('pages, and caps a caller asking for everything at once', async () => {
    await AuditEvent.insertMany(Array.from({ length: 5 }, (_, i) => event({ resource: `r${i}` })));

    const { events, total, totalPages } = await listAuditEvents({ userId: 'u1', limit: 2, page: 2 });

    expect(events).toHaveLength(2);
    expect(total).toBe(5);
    expect(totalPages).toBe(3);

    const capped = await listAuditEvents({ userId: 'u1', limit: 5000 });
    expect(capped.events.length).toBeLessThanOrEqual(200);
  });
});
