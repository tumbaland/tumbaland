jest.mock('@tumbaland/backend-core', () => ({
  verifyApiKey: jest.fn(),
  verifyAccessToken: jest.fn(),
  looksLikeApiKey: (t: string) => typeof t === 'string' && t.startsWith('tmb_live_'),
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  requireEnv: (name: string) => process.env[name] ?? `missing:${name}`
}));

jest.mock('../tumbaland', () => {
  const actual = jest.requireActual('../tumbaland');
  return {
    ...actual,
    tumbaland: {
      listActivityTypes: jest.fn(),
      createActivity: jest.fn(),
      saveDay: jest.fn(),
      getDay: jest.fn(),
      listActivities: jest.fn(),
      getStatistics: jest.fn(),
      getTrends: jest.fn()
    }
  };
});

import request from 'supertest';
import { verifyApiKey } from '@tumbaland/backend-core';
import { tumbaland, TumbalandError } from '../tumbaland';
import { createApp } from '../app';

const mockedVerify = verifyApiKey as jest.Mock;
const api = tumbaland as jest.Mocked<typeof tumbaland>;
const app = createApp();
const KEY = 'tmb_live_abcdef123456_aaaaaaaaaaaaaaaaaaaaaaaa';

const TYPES = [
  { _id: 't1', name: 'Dining', slug: 'dining', valueType: 'string' as const, hasLocation: true },
  { _id: 't2', name: 'Together', slug: 'together', valueType: 'number' as const, hasLocation: false }
];

/** Call a tool the way a client does, and hand back the text the model sees. */
async function callTool(name: string, args: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/mcp')
    .set('Authorization', `Bearer ${KEY}`)
    .set('Accept', 'application/json, text/event-stream')
    .send({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });

  const payload = JSON.parse(res.text.split('data: ')[1] ?? '{}');
  return {
    isError: Boolean(payload.result?.isError),
    text: payload.result?.content?.[0]?.text ?? ''
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedVerify.mockResolvedValue({
    ok: true,
    userId: 'u1',
    keyId: 'k1',
    scopes: ['relationship:read', 'relationship:write'],
    groupId: null
  });
  api.listActivityTypes.mockResolvedValue(TYPES);
  api.getDay.mockResolvedValue([]);
  api.saveDay.mockResolvedValue(undefined);
});

describe('list_activity_types', () => {
  it('describes each type in terms of what it records', async () => {
    const { text } = await callTool('list_activity_types');

    expect(text).toContain('Dining (takes a short description, can carry a place)');
    expect(text).toContain('Together (takes a number of hours)');
  });

  it('says plainly when an account has none yet', async () => {
    api.listActivityTypes.mockResolvedValue([]);
    const { text } = await callTool('list_activity_types');
    expect(text).toContain('No activity types are defined yet');
  });
});

describe('log_day', () => {
  it('resolves type names to ids so the model never handles one', async () => {
    await callTool('log_day', { date: '2026-09-04', entries: [{ type: 'Dining', description: 'Kolm Sõsarat' }] });

    const [, , entries] = api.saveDay.mock.calls[0];
    expect(entries).toEqual([{ typeId: 't1', description: 'Kolm Sõsarat', hours: undefined }]);
  });

  it('carries the day’s existing entries through, rather than deleting them', async () => {
    // The endpoint underneath removes anything absent from the list. An agent
    // asked to add one thing cannot know what else is on the day, so without
    // this it would silently wipe it.
    api.getDay.mockResolvedValue([
      { _id: 'existing-1', typeId: 't2', hours: 3 }
    ]);

    await callTool('log_day', { date: '2026-09-04', entries: [{ type: 'Dining' }] });

    const [, , entries] = api.saveDay.mock.calls[0];
    expect(entries).toHaveLength(2);
    // Carried by _id, which is what marks it as an entry to keep.
    expect(entries[0]).toMatchObject({ _id: 'existing-1', typeId: 't2' });
  });

  it('says how many entries it kept, so the user can see nothing was lost', async () => {
    api.getDay.mockResolvedValue([{ _id: 'e1', typeId: 't2' }]);
    const { text } = await callTool('log_day', { date: '2026-09-04', entries: [{ type: 'Dining' }] });
    expect(text).toContain('alongside 1 already logged');
  });

  it('replaces the day only when explicitly asked', async () => {
    api.getDay.mockResolvedValue([{ _id: 'e1', typeId: 't2' }]);

    await callTool('log_day', {
      date: '2026-09-04',
      entries: [{ type: 'Dining' }],
      replace: true
    });

    const [, , entries] = api.saveDay.mock.calls[0];
    expect(entries).toHaveLength(1);
    expect(api.getDay).not.toHaveBeenCalled();
  });

  it('fails before writing when a type name is unknown, naming the real ones', async () => {
    const { isError, text } = await callTool('log_day', {
      date: '2026-09-04',
      entries: [{ type: 'Brunch' }]
    });

    expect(isError).toBe(true);
    expect(text).toContain('Dining');
    expect(text).toContain('Together');
    expect(api.saveDay).not.toHaveBeenCalled();
  });
});

describe('log_activity', () => {
  it('creates a single entry against the resolved type', async () => {
    api.createActivity.mockResolvedValue({ _id: 'a1' } as never);

    const { text } = await callTool('log_activity', {
      date: '2026-09-04',
      type: 'together',
      hours: 4
    });

    expect(api.createActivity).toHaveBeenCalledWith(KEY, {
      date: '2026-09-04',
      typeId: 't2',
      description: undefined,
      hours: 4
    });
    expect(text).toContain('Together');
  });
});

describe('search_activities', () => {
  it('renders results with type names rather than ids', async () => {
    api.listActivities.mockResolvedValue([
      { _id: 'a1', date: '2026-09-04T00:00:00.000Z', typeId: 't1', description: 'Kolm Sõsarat' }
    ] as never);

    const { text } = await callTool('search_activities', {});

    expect(text).toContain('2026-09-04: Dining — Kolm Sõsarat');
    expect(text).not.toContain('t1');
  });

  it('reads the name off a populated type, which is what /activities returns', async () => {
    // The two endpoints disagree: /days sends a bare id, /activities sends the
    // whole type document. Reading it as an id labelled every real result
    // "Unknown type" while the search itself looked like it worked.
    api.listActivities.mockResolvedValue([
      {
        _id: 'a1',
        date: '2026-09-04T00:00:00.000Z',
        typeId: { _id: 't1', name: 'Dining', slug: 'dining', valueType: 'string', hasLocation: true },
        description: 'Kolm Sõsarat'
      }
    ] as never);

    const { text } = await callTool('search_activities', {});

    expect(text).toContain('Dining — Kolm Sõsarat');
    expect(text).not.toContain('Unknown type');
  });

  it('falls back to Unknown type only when neither shape names one', async () => {
    api.listActivities.mockResolvedValue([
      { _id: 'a1', date: '2026-09-04T00:00:00.000Z', typeId: 'deleted-type' }
    ] as never);

    const { text } = await callTool('search_activities', {});
    expect(text).toContain('Unknown type');
  });

  it('filters by slug, which is what the endpoint reads', async () => {
    api.listActivities.mockResolvedValue([]);

    await callTool('search_activities', { from: '2026-09-01', to: '2026-09-04', type: 'Dining' });

    expect(api.listActivities).toHaveBeenCalledWith(KEY, {
      startDate: '2026-09-01',
      endDate: '2026-09-04',
      activityType: 'dining',
      limit: 20
    });
  });

  it('says so when nothing matches', async () => {
    api.listActivities.mockResolvedValue([]);
    const { text } = await callTool('search_activities', {});
    expect(text).toBe('Nothing logged matching that.');
  });
});

describe('get_stats', () => {
  it('returns the numbers as JSON for the model to quote', async () => {
    api.getStatistics.mockResolvedValue({ totalActivities: 12 });
    api.getTrends.mockResolvedValue({ types: [] });

    const { text } = await callTool('get_stats', { timeframe: 'month' });

    expect(JSON.parse(text)).toMatchObject({ statistics: { totalActivities: 12 } });
    expect(api.getStatistics).toHaveBeenCalledWith(KEY, 'month');
  });
});

describe('errors the model can act on', () => {
  it('tells it not to retry a scope failure, since only a new key fixes that', async () => {
    api.listActivityTypes.mockRejectedValue(new TumbalandError('missing scope', 403));

    const { isError, text } = await callTool('list_activity_types');

    expect(isError).toBe(true);
    expect(text).toContain('Do not retry');
    expect(text).toContain('account settings');
  });

  it('tells it not to retry a rejected credential either', async () => {
    api.listActivityTypes.mockRejectedValue(new TumbalandError('nope', 401));
    const { text } = await callTool('list_activity_types');
    expect(text).toContain('Do not retry');
  });

  it('passes an ordinary failure through as its message', async () => {
    api.listActivityTypes.mockRejectedValue(new TumbalandError('Date must be YYYY-MM-DD', 400));
    const { text } = await callTool('list_activity_types');
    expect(text).toBe('Date must be YYYY-MM-DD');
  });

  it('does not leak a stack trace for an unexpected error', async () => {
    api.listActivityTypes.mockRejectedValue(new Error('socket hang up'));
    const { text } = await callTool('list_activity_types');
    expect(text).toBe('socket hang up');
  });
});
