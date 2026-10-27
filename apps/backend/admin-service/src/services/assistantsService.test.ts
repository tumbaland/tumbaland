import { ApiKey, OAuthClient, RefreshToken } from '@tumbaland/backend-core';
import { at, NOW, toolCall, user, write } from '../test/seed';
import { clearDb, startDb, stopDb } from '../test/mongo';
import { seedCredentials } from '../test/credentials';
import { getAssistants } from './assistantsService';

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

async function seed() {
  const ada = await user('ada@example.com');
  const bob = await user('bob@example.com');
  await seedCredentials(ada.id); // Claude (twice) and Other Assistant connected; three keys, one usable

  await toolCall({ userId: ada.id, at: '2026-10-26T10:00:00Z', tool: 'get_day', tokens: 100, ms: 100 });
  await toolCall({ userId: ada.id, at: '2026-10-26T11:00:00Z', tool: 'get_day', tokens: 100, ms: 300, failed: true });
  await toolCall({ userId: bob.id, at: '2026-10-27T10:00:00Z', tool: 'log_day', tokens: 900, ms: 200 });
  await toolCall({
    userId: bob.id,
    at: '2026-10-27T11:00:00Z',
    tool: 'get_day',
    tokens: 50,
    credentialId: 'client-other',
    label: 'Other Assistant'
  });
  // Outside the window.
  await toolCall({ userId: ada.id, at: '2026-07-01T10:00:00Z', tokens: 99999 });
  // A key's own activity, not a tool call.
  await write({ userId: ada.id, at: '2026-10-25T10:00:00Z', actorKind: 'key', action: 'read' });
  await write({ userId: ada.id, at: '2026-10-25T11:00:00Z', actorKind: 'key', action: 'create' });
  await write({ userId: ada.id, at: '2026-05-25T11:00:00Z', actorKind: 'key', action: 'create' });
  return { ada, bob };
}

describe('getAssistants', () => {
  it('totals what assistants did in the window', async () => {
    await seed();

    const { totals, windowDays } = await getAssistants({ days: 30, now: NOW });

    expect(windowDays).toBe(30);
    expect(totals).toEqual({ calls: 4, failed: 1, tokens: 1150, accounts: 2 });
  });

  it('lists each app with the accounts connected and what it did', async () => {
    await seed();

    const { clients } = await getAssistants({ days: 30, now: NOW });

    expect(clients).toEqual([
      {
        clientId: 'client-claude',
        name: 'Claude',
        connectedAccounts: 1, // one account, however many sessions it connected from
        calls: 3,
        failed: 1,
        tokens: 1100,
        activeAccounts: 2,
        lastCallAt: '2026-10-27T10:00:00.000Z'
      },
      {
        clientId: 'client-other',
        name: 'Other Assistant',
        connectedAccounts: 1,
        calls: 1,
        failed: 0,
        tokens: 50,
        activeAccounts: 1,
        lastCallAt: '2026-10-27T11:00:00.000Z'
      }
    ]);
  });

  it('still lists an app that is connected but has done nothing, and one that only has history', async () => {
    const ada = await user('ada@example.com');
    await OAuthClient.collection.insertOne({ clientId: 'quiet', clientName: 'Quiet App', redirectUris: ['https://q.example/cb'] });
    await RefreshToken.collection.insertOne({
      tokenHash: 'h',
      clientId: 'quiet',
      userId: ada.id,
      resource: 'r',
      createdAt: at('2026-10-01T10:00:00Z')
    });
    // Calls from an app that was since removed from the registry: named from its own rows.
    await toolCall({ userId: ada.id, at: '2026-10-26T10:00:00Z', credentialId: 'gone', label: 'Old App' });

    const { clients } = await getAssistants({ days: 30, now: NOW });

    expect(clients.map((client) => [client.name, client.connectedAccounts, client.calls])).toEqual([
      ['Old App', 0, 1],
      ['Quiet App', 1, 0]
    ]);
  });

  it('names an app it only knows from its rows by the newest name it used', async () => {
    const ada = await user('ada@example.com');
    await toolCall({ userId: ada.id, at: '2026-10-27T10:00:00Z', credentialId: 'gone', label: 'New Name' });
    await toolCall({ userId: ada.id, at: '2026-10-20T10:00:00Z', credentialId: 'gone', label: 'Old Name' });
    await toolCall({ userId: ada.id, at: '2026-10-25T10:00:00Z', credentialId: 'gone', label: 'Middle Name' });

    const { clients } = await getAssistants({ days: 30, now: NOW });

    expect(clients.map((client) => client.name)).toEqual(['New Name']);
  });

  it('ranks tools by the tokens they hand the model', async () => {
    await seed();

    const { tools } = await getAssistants({ days: 30, now: NOW });

    expect(tools).toEqual([
      { name: 'log_day', calls: 1, failed: 0, failureRate: 0, tokens: 900, avgTokens: 900, avgMs: 200 },
      { name: 'get_day', calls: 3, failed: 1, failureRate: 1 / 3, tokens: 250, avgTokens: 83, avgMs: 167 }
    ]);
  });

  it('counts live keys and what keys did in the window', async () => {
    await seed();

    expect((await getAssistants({ days: 30, now: NOW })).keys).toEqual({ live: 1, actionsInWindow: 2 });
  });

  it('reaches further back when asked', async () => {
    await seed();

    const { totals, keys } = await getAssistants({ days: 365, now: NOW });

    expect(totals.calls).toBe(5);
    expect(keys.actionsInWindow).toBe(3);
  });

  it('is empty when nothing has happened', async () => {
    expect(await getAssistants({ now: NOW })).toEqual({
      windowDays: 30,
      totals: { calls: 0, failed: 0, tokens: 0, accounts: 0 },
      clients: [],
      tools: [],
      keys: { live: 0, actionsInWindow: 0 }
    });
  });

  it('does not count a revoked key or an expired one as live', async () => {
    const ada = await user('ada@example.com');
    const key = (keyId: string, fields: Record<string, unknown> = {}) => ({
      userId: ada.id,
      userEmail: ada.email,
      userName: 'Ada',
      name: keyId,
      keyId,
      hash: 'h',
      sealedCiphertext: 'c',
      sealedIv: 'i',
      sealedTag: 't',
      scopes: [],
      tenants: ['personal'],
      defaultTenant: 'personal',
      revealCount: 0,
      createdAt: at('2026-10-01T10:00:00Z'),
      ...fields
    });
    await ApiKey.collection.insertMany([
      key('forever'),
      key('null-expiry', { expiresAt: null }),
      key('future', { expiresAt: at('2027-01-01T00:00:00Z') }),
      key('past', { expiresAt: at('2026-10-01T00:00:00Z') }),
      key('revoked', { revokedAt: at('2026-10-02T00:00:00Z') })
    ]);

    expect((await getAssistants({ now: NOW })).keys.live).toBe(3);
  });

  it('defaults to the real clock', async () => {
    expect((await getAssistants()).windowDays).toBe(30);
  });
});
