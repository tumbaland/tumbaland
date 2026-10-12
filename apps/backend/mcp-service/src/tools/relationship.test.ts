jest.mock('@tumbaland/backend-core', () => ({
  // The tenant constants come from the real module rather than being restated
  // here. A hand-listed mock silently dropped PERSONAL_TENANT once, and the code
  // comparing against `undefined` then sent the literal 'personal' to the API as
  // though it were a group id — a mock disagreeing with the library it stands in
  // for, which is the failure this integration keeps hitting.
  //
  // Reached by its own path: requiring the package root pulls in the whole
  // library, and one of its transitive dependencies ships ESM that Jest will not
  // transform. This file has no imports at all.
  ...jest.requireActual('@tumbaland/backend-core/dist/apiKeys/types'),
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
      getActivity: jest.fn(),
      updateActivity: jest.fn(),
      deleteActivity: jest.fn(),
      getStatistics: jest.fn(),
      getTrends: jest.fn(),
      listPlans: jest.fn(),
      getPlan: jest.fn(),
      createPlan: jest.fn(),
      updatePlan: jest.fn(),
      deletePlan: jest.fn()
    }
  };
});

import request from 'supertest';
import { verifyApiKey } from '@tumbaland/backend-core';
import { tumbaland, TumbalandError } from '../tumbaland';
import { createApp } from '../app';

/**
 * The JSON out of one SSE frame.
 *
 * Split on the *first* delimiter rather than every one: a tool result is free
 * to contain the string "data: " — one of them does — and splitting on all of
 * them truncates the payload mid-string, which surfaces as a JSON parse error
 * about the transport and says nothing about the tool.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sseBody = (text: string): any => {
  const at = text.indexOf('data: ');
  return JSON.parse(at === -1 ? '{}' : text.slice(at + 'data: '.length));
};

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

  const payload = sseBody(res.text);
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
    tenants: { allowed: ['personal'], default: 'personal' },
    tenantNames: { personal: 'My own data' }
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
    await callTool('log_day', { date: '2026-09-04', entries: [{ type: 'Dining', description: 'Sushi House' }] });

    const [, , entries] = api.saveDay.mock.calls[0];
    expect(entries).toEqual([{ typeId: 't1', description: 'Sushi House', hours: undefined }]);
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

    expect(api.createActivity).toHaveBeenCalledWith(
      KEY,
      { date: '2026-09-04', typeId: 't2', description: undefined, hours: 4 },
      undefined
    );
    expect(text).toContain('Together');
  });
});

describe('search_activities', () => {
  it('renders results with type names rather than ids', async () => {
    api.listActivities.mockResolvedValue([
      { _id: 'a1', date: '2026-09-04T00:00:00.000Z', typeId: 't1', description: 'Sushi House' }
    ] as never);

    const { text } = await callTool('search_activities', {});

    expect(text).toContain('2026-09-04: Dining — Sushi House');
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
        description: 'Sushi House'
      }
    ] as never);

    const { text } = await callTool('search_activities', {});

    expect(text).toContain('Dining — Sushi House');
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
  const STATISTICS = {
    totalActivities: 12,
    totalHours: 40,
    firstEntryDate: '2024-01-18',
    daysSinceFirstEntry: 961,
    types: [
      { name: 'Together', count: 7, totalHours: 40, uniqueDays: 7 },
      { name: 'Gaming', count: 5, totalHours: 0, uniqueDays: 4 }
    ]
  };

  const TRENDS = {
    windowDays: 30,
    currentStart: '2026-08-07',
    currentEnd: '2026-09-05',
    totals: {
      current: { entries: 53, hours: 37, activeDays: 22 },
      previous: { entries: 74, hours: 230, activeDays: 27 },
      entriesChangePct: -28.4,
      hoursChangePct: -83.9,
      direction: 'down'
    },
    types: [{ name: 'Gaming', current: { entries: 31 }, previous: { entries: 23 }, entriesChangePct: 34.8, direction: 'up' }]
  };

  it('reads the totals and the type breakdown as prose', async () => {
    api.getStatistics.mockResolvedValue(STATISTICS);
    api.getTrends.mockResolvedValue({ types: [] });

    const { text } = await callTool('get_stats', { timeframe: 'month' });

    expect(text).toContain('12 entries over the last month since 2024-01-18 (961 days), 40 hours logged.');
    expect(text).toContain('- Together: 7 entries on 7 days, 40h');
    expect(api.getStatistics).toHaveBeenCalledWith(KEY, 'month', undefined);
  });

  it('leaves the hours off a type that is not measured in them', async () => {
    api.getStatistics.mockResolvedValue(STATISTICS);
    api.getTrends.mockResolvedValue({ types: [] });

    const { text } = await callTool('get_stats', {});

    // "0h" against a type counted in entries reads as a real zero, which is a
    // different and wrong answer.
    expect(text).toContain('- Gaming: 5 entries on 4 days');
    expect(text).not.toContain('Gaming: 5 entries on 4 days, 0h');
  });

  it('compares the window with the one before it', async () => {
    api.getStatistics.mockResolvedValue(STATISTICS);
    api.getTrends.mockResolvedValue(TRENDS);

    const { text } = await callTool('get_stats', {});

    expect(text).toContain('Last 30 days (2026-08-07 to 2026-09-05) against the 30 before');
    expect(text).toContain('53 entries vs 74 (-28.4%)');
    expect(text).toContain('37h vs 230h (-83.9%)');
    expect(text).toContain('Overall down.');
    expect(text).toContain('- Gaming: 31 vs 23 entries (+34.8%), up');
  });

  it('stays small enough to carry through a conversation', async () => {
    api.getStatistics.mockResolvedValue(STATISTICS);
    api.getTrends.mockResolvedValue(TRENDS);

    const { text } = await callTool('get_stats', {});

    // The guard this whole rewrite exists for. A tool result is resent with
    // every later turn, so a few hundred characters and a few thousand are not
    // the same decision.
    expect(text.length).toBeLessThan(1500);
  });

  it('renders a sparse response without leaking "undefined" into a sentence', async () => {
    // A fresh account has no first entry, no hours and no trend window to
    // compare against. The failure mode is not a crash but the word
    // "undefined" in a sentence the model quotes back to somebody.
    api.getStatistics.mockResolvedValue({ totalActivities: 3, types: [{ name: 'Coffee', count: 3 }] });
    api.getTrends.mockResolvedValue({ types: [] });

    const { text } = await callTool('get_stats', {});

    expect(text).not.toMatch(/undefined|NaN|null/);
    expect(text).toContain('3 entries in total.');
    expect(text).toContain('- Coffee: 3 entries');
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

/**
 * Editing was the gap that made this server awkward to use: with no way to name
 * a single entry, an assistant asked to fix one word had to read the day back
 * and rewrite all of it. These tests hold the three things that closed it — an
 * id in every listing, a change scoped to the fields given, and an answer that
 * says which entry moved.
 */
const ENTRY = {
  _id: 'a1',
  date: '2026-09-04T00:00:00.000Z',
  typeId: 't1',
  description: 'Sushi House',
  hours: 2
};

describe('get_day', () => {
  it('gives every entry an id, which is where editing starts', async () => {
    api.getDay.mockResolvedValue([
      { _id: 'a1', typeId: 't1', description: 'Sushi House' },
      { _id: 'a2', typeId: 't2', hours: 3 }
    ]);

    const { text } = await callTool('get_day', { date: '2026-09-04' });

    expect(text).toContain('Dining — Sushi House  [id a1]');
    expect(text).toContain('Together (3h)  [id a2]');
  });

  it('names the type rather than showing its id', async () => {
    api.getDay.mockResolvedValue([{ _id: 'a1', typeId: 't1' }]);
    const { text } = await callTool('get_day', { date: '2026-09-04' });
    expect(text).not.toContain('t1');
  });

  it('says a day is empty rather than returning nothing', async () => {
    const { text } = await callTool('get_day', { date: '2026-09-04' });
    expect(text).toBe('Nothing logged on 2026-09-04.');
  });
});

describe('search_activities', () => {
  it('carries ids too, so an edit can follow a search', async () => {
    api.listActivities.mockResolvedValue([{ ...ENTRY, typeId: TYPES[0] }]);

    const { text } = await callTool('search_activities', { type: 'Dining' });

    expect(text).toContain('[id a1]');
  });
});

describe('edit_activity', () => {
  beforeEach(() => {
    api.getActivity.mockResolvedValue(ENTRY);
    api.updateActivity.mockResolvedValue({ ...ENTRY, description: 'Sushi House, terrace' });
  });

  it('changes only the fields it was given', async () => {
    await callTool('edit_activity', { id: 'a1', description: 'Sushi House, terrace' });

    expect(api.updateActivity).toHaveBeenCalledWith(
      KEY,
      'a1',
      { date: undefined, typeId: undefined, description: 'Sushi House, terrace', hours: undefined },
      undefined
    );
  });

  it('resolves a new type by name, never by id', async () => {
    await callTool('edit_activity', { id: 'a1', type: 'Together' });

    expect(api.updateActivity).toHaveBeenCalledWith(
      KEY,
      'a1',
      expect.objectContaining({ typeId: 't2' }),
      undefined
    );
  });

  it('rejects a type that does not exist, listing the real ones', async () => {
    const { isError, text } = await callTool('edit_activity', { id: 'a1', type: 'Brunch' });

    expect(isError).toBe(true);
    expect(text).toContain('Dining, Together');
    expect(api.updateActivity).not.toHaveBeenCalled();
  });

  it('shows what changed, so the wrong entry is visible to the user', async () => {
    const { text } = await callTool('edit_activity', { id: 'a1', description: 'Sushi House, terrace' });

    // An id the model copied is one transcription away from the wrong entry,
    // and naming both sides is the only thing that surfaces that.
    expect(text).toContain('from - 2026-09-04: Dining (2h) — Sushi House  [id a1]');
    expect(text).toContain('to   - 2026-09-04: Dining (2h) — Sushi House, terrace  [id a1]');
  });

  it('refuses an edit that changes nothing', async () => {
    const { isError, text } = await callTool('edit_activity', { id: 'a1' });

    expect(isError).toBe(true);
    expect(text).toContain('at least one of date, type, description or hours');
    expect(api.updateActivity).not.toHaveBeenCalled();
  });

  it('does not write when the id could not be read back', async () => {
    api.getActivity.mockRejectedValue(new TumbalandError('Activity not found', 404));

    const { isError, text } = await callTool('edit_activity', { id: 'wrong', hours: 1 });

    expect(isError).toBe(true);
    expect(text).toBe('Activity not found');
    expect(api.updateActivity).not.toHaveBeenCalled();
  });
});

describe('delete_activity', () => {
  it('reports what it removed, since there is no undo', async () => {
    api.getActivity.mockResolvedValue(ENTRY);
    api.deleteActivity.mockResolvedValue(undefined);

    const { text } = await callTool('delete_activity', { id: 'a1' });

    expect(text).toContain('Deleted');
    expect(text).toContain('2026-09-04: Dining (2h) — Sushi House');
    expect(api.deleteActivity).toHaveBeenCalledWith(KEY, 'a1', undefined);
  });

  it('deletes nothing when the entry could not be read first', async () => {
    api.getActivity.mockRejectedValue(new TumbalandError('Activity not found', 404));

    const { isError } = await callTool('delete_activity', { id: 'wrong' });

    expect(isError).toBe(true);
    expect(api.deleteActivity).not.toHaveBeenCalled();
  });
});

/**
 * A connection may now reach more than one tenant, so the tenant is settled per
 * call instead of being a fixed property of the credential. Two things have to
 * hold: a connection granted one tenant must not learn that tenants exist, and a
 * connection granted several must never guess which one silently.
 */
describe('choosing a journal', () => {
  const both = {
    ok: true,
    userId: 'u1',
    keyId: 'k1',
    scopes: ['relationship:read', 'relationship:write'],
    tenants: { allowed: ['personal', 'g1'], default: 'g1' },
    tenantNames: { personal: 'My own data', g1: 'Irja & Tom' }
  };

  /** The tools as a client is shown them. */
  async function toolsList() {
    const res = await request(app)
      .post('/mcp')
      .set('Authorization', `Bearer ${KEY}`)
      .set('Accept', 'application/json, text/event-stream')
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });

    const payload = sseBody(res.text);
    return (payload.result?.tools ?? []) as { name: string; inputSchema: { properties?: object } }[];
  }

  it('offers no journal parameter when only one tenant was granted', async () => {
    // A model shown a choice it cannot get wrong will eventually get it wrong;
    // one that is never told there is a choice cannot.
    const tools = await toolsList();

    for (const tool of tools) {
      expect(Object.keys(tool.inputSchema.properties ?? {})).not.toContain('journal');
    }
  });

  it('offers it on every tool when several were granted', async () => {
    mockedVerify.mockResolvedValue(both);

    const tools = await toolsList();

    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) {
      expect(Object.keys(tool.inputSchema.properties ?? {})).toContain('journal');
    }
  });

  it('names the real journals in the parameter, not their ids', async () => {
    mockedVerify.mockResolvedValue(both);

    const tools = await toolsList();
    const described = JSON.stringify(tools);

    expect(described).toContain('Irja &amp; Tom'.replace('&amp;', '&'));
    expect(described).toContain('Defaults to Irja & Tom');
  });

  it('uses the default when a call names none', async () => {
    mockedVerify.mockResolvedValue(both);

    await callTool('list_activity_types');

    expect(api.listActivityTypes).toHaveBeenCalledWith(KEY, 'g1');
  });

  it('uses the named journal when a call asks for one', async () => {
    mockedVerify.mockResolvedValue(both);

    await callTool('search_activities', { journal: 'My own data' });

    // Personal travels as no group at all, which is how every handler has
    // always read it.
    expect(api.listActivities).toHaveBeenCalledWith(KEY, expect.objectContaining({ groupId: undefined }));
  });

  it('carries the choice into a write, not only a read', async () => {
    mockedVerify.mockResolvedValue(both);
    api.createActivity.mockResolvedValue({ _id: 'a1' } as never);

    await callTool('log_activity', { date: '2026-09-04', type: 'Dining', journal: 'Irja & Tom' });

    expect(api.createActivity).toHaveBeenCalledWith(KEY, expect.any(Object), 'g1');
  });

  it('matches a journal name case-insensitively, as people type it', async () => {
    mockedVerify.mockResolvedValue(both);

    await callTool('list_activity_types', { journal: 'irja & tom' });

    expect(api.listActivityTypes).toHaveBeenCalledWith(KEY, 'g1');
  });

  it('refuses a journal outside the grant instead of quietly using the default', async () => {
    mockedVerify.mockResolvedValue(both);

    const { isError, text } = await callTool('log_activity', {
      date: '2026-09-04',
      type: 'Dining',
      journal: 'Someone else'
    });

    // Writing an entry into the wrong journal is not a failure anyone notices,
    // so a miss has to be loud.
    expect(isError).toBe(true);
    expect(text).toContain('My own data, Irja & Tom');
    expect(api.createActivity).not.toHaveBeenCalled();
  });
});

describe('plans', () => {
  const concert = {
    _id: 'p1',
    title: 'Concert',
    date: '2026-10-16',
    endDate: null,
    time: '19:00',
    remindBefore: 60,
    loggedActivityId: null,
    location: { label: 'Saku Arena' }
  };
  const trip = { ...concert, _id: 'p2', title: 'Rome', endDate: '2026-10-18', time: null, remindBefore: 1440, location: null };

  it('lists what is coming up from today when no days are given', async () => {
    api.listPlans.mockResolvedValue([concert, trip]);
    const { text } = await callTool('list_plans', { today: '2026-10-12' });

    expect(api.listPlans).toHaveBeenCalledWith(expect.any(String), {
      startDate: '2026-10-12',
      endDate: undefined,
      upcoming: true,
      limit: 50,
      groupId: undefined
    });
    expect(text).toContain('- 2026-10-16 19:00: Concert at Saku Arena (reminder 1 hour before)  [id p1]');
    expect(text).toContain('- 2026-10-16 to 2026-10-18: Rome (reminder the day before at 09:00)  [id p2]');
  });

  it('reads a range of days, and says when it is empty', async () => {
    api.listPlans.mockResolvedValue([]);
    const { text } = await callTool('list_plans', { from: '2026-11-01', to: '2026-11-30' });
    expect(api.listPlans).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ upcoming: false, startDate: '2026-11-01' }));
    expect(text).toBe('No plans in those days.');
  });

  it('defaults upcoming to today in Tallinn', async () => {
    api.listPlans.mockResolvedValue([]);
    const { text } = await callTool('list_plans');
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Tallinn' }).format(new Date());
    expect(api.listPlans.mock.calls[0][1].startDate).toBe(today);
    expect(text).toBe('Nothing planned from today on.');
  });

  it('plans something with its type resolved by name', async () => {
    api.createPlan.mockResolvedValue({ ...concert, remindBefore: null, time: null });
    const { text } = await callTool('plan_event', {
      title: 'Concert',
      date: '2026-10-16',
      type: 'dining',
      remindBefore: null
    });

    expect(api.createPlan).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ title: 'Concert', date: '2026-10-16', typeId: 't1', remindBefore: null }),
      undefined
    );
    expect(text).toContain('Planned');
    expect(text).toContain('(all day): Concert at Saku Arena (no reminder)');
  });

  it('refuses a 12-hour time before anything is written', async () => {
    const { isError } = await callTool('plan_event', { title: 'Concert', date: '2026-10-16', time: '7pm' });
    expect(isError).toBe(true);
    expect(api.createPlan).not.toHaveBeenCalled();
  });

  it('changes a plan and says what it was and what it is', async () => {
    api.getPlan.mockResolvedValue(concert);
    api.updatePlan.mockResolvedValue({ ...concert, date: '2026-10-17', remindBefore: 180, loggedActivityId: 'a1' });
    const { text } = await callTool('edit_plan', { id: 'p1', date: '2026-10-17', remindBefore: 180, type: 'Together' });

    expect(api.updatePlan).toHaveBeenCalledWith(
      expect.any(String),
      'p1',
      expect.objectContaining({ date: '2026-10-17', remindBefore: 180, typeId: 't2' }),
      undefined
    );
    expect(text).toContain('from - 2026-10-16 19:00');
    expect(text).toContain('to   - 2026-10-17 19:00: Concert at Saku Arena (reminder 3 hours before, logged in the journal)');
  });

  it('needs something to change', async () => {
    const { isError, text } = await callTool('edit_plan', { id: 'p1' });
    expect(isError).toBe(true);
    expect(text).toContain('Nothing to change');
  });

  it('removes a plan and says which', async () => {
    api.getPlan.mockResolvedValue({ ...concert, remindBefore: 30, time: '18:30' });
    api.deletePlan.mockResolvedValue(undefined);
    const { text } = await callTool('delete_plan', { id: 'p1' });
    expect(api.deletePlan).toHaveBeenCalledWith(expect.any(String), 'p1', undefined);
    expect(text).toContain('Deleted');
    expect(text).toContain('(reminder 30 minutes before)');
  });

  it('words reminders of days, and that morning for an all-day plan', async () => {
    api.listPlans.mockResolvedValue([
      { ...concert, remindBefore: 2880 },
      { ...concert, _id: 'p3', time: null, remindBefore: 0 }
    ]);
    const { text } = await callTool('list_plans', { today: '2026-10-12' });
    expect(text).toContain('reminder 2 days before');
    expect(text).toContain('reminder that morning at 09:00');
  });

  it('turns an API failure into a sentence', async () => {
    api.getPlan.mockRejectedValue(new TumbalandError('Plan not found', 404));
    const { isError, text } = await callTool('delete_plan', { id: 'nope' });
    expect(isError).toBe(true);
    expect(text).toContain('Plan not found');
    expect(api.deletePlan).not.toHaveBeenCalled();
  });
});
