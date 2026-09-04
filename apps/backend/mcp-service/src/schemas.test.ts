jest.mock('@tumbaland/backend-core', () => ({
  requireEnv: () => 'http://relationship-service:4001'
}));

import fixtures from './__fixtures__/relationship-api.json';
import {
  activitiesResponseSchema,
  activityTypesResponseSchema,
  daysResponseSchema,
  parseResponse,
  ShapeError
} from './schemas';
import { tumbaland, activityTypeOf, Activity } from './tumbaland';

/**
 * These fixtures were captured from the live relationship API and then had
 * their free text replaced; every key, type and nesting level is exactly what
 * the service returned.
 *
 * That is the whole point. The four shape bugs in this integration all had the
 * same cause — a hand-written mock encoding the same wrong belief as the code,
 * so the tests agreed with the code and both disagreed with the service. A
 * recorded response cannot do that.
 */

const respond = (body: unknown) =>
  Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify({ success: true, data: body }) } as Response);

const KEY = 'tmb_live_abcdef123456_secret';

beforeEach(() => {
  global.fetch = jest.fn() as unknown as typeof fetch;
});

describe('the recorded responses parse', () => {
  it('accepts a real /activity-types response', () => {
    const parsed = parseResponse(activityTypesResponseSchema, '/activity-types', fixtures.activityTypes);
    expect(parsed.types.length).toBeGreaterThan(0);
    expect(parsed.types[0]).toMatchObject({ _id: expect.any(String), name: expect.any(String) });
  });

  it('accepts a real /activities response, where typeId is populated', () => {
    const parsed = parseResponse(activitiesResponseSchema, '/activities', fixtures.activities);
    // Recorded, not assumed: this endpoint sends the whole type document.
    expect(typeof parsed.activities[0].typeId).toBe('object');
  });

  it('accepts a real /days response, where typeId is a bare id', () => {
    const parsed = parseResponse(daysResponseSchema, '/days', fixtures.days);
    // The two endpoints genuinely disagree, which is why both are handled.
    expect(typeof parsed.days[0].entries[0].typeId).toBe('string');
  });
});

describe('the client against recorded responses', () => {
  it('unwraps the named collection /activity-types returns', async () => {
    (global.fetch as jest.Mock).mockReturnValue(respond(fixtures.activityTypes));

    const types = await tumbaland.listActivityTypes(KEY);

    expect(types.length).toBe(fixtures.activityTypes.types.length);
    expect(types[0].name).toBe(fixtures.activityTypes.types[0].name);
  });

  it('reads a day’s entries with their ids, which the merge depends on', async () => {
    const date = fixtures.days.days[0].date;
    (global.fetch as jest.Mock).mockReturnValue(respond(fixtures.days));

    const entries = await tumbaland.getDay(KEY, date);

    // Without `_id` the save would delete these rather than keep them.
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]._id).toEqual(expect.any(String));
    expect(typeof entries[0].typeId).toBe('string');
  });

  it('names the type of a real activity rather than calling it unknown', async () => {
    (global.fetch as jest.Mock).mockReturnValue(respond(fixtures.activities));

    const activities = await tumbaland.listActivities(KEY, {});
    const names = new Map(fixtures.activityTypes.types.map((t) => [t._id, t.name]));

    for (const activity of activities) {
      expect(activityTypeOf(activity as Activity, names)).toEqual(expect.any(String));
    }
  });
});

describe('a changed contract fails loudly', () => {
  it('rejects a bare array where a named collection is returned', () => {
    // The original bug: `types.map is not a function`, deep inside a tool.
    expect(() => parseResponse(activityTypesResponseSchema, '/activity-types', [])).toThrow(ShapeError);
  });

  it('names the field that was wrong, so the report is actionable', () => {
    const broken = { types: [{ _id: 'x', slug: 'y', valueType: 'string', hasLocation: false }] };

    try {
      parseResponse(activityTypesResponseSchema, '/activity-types', broken);
      throw new Error('should have thrown');
    } catch (error) {
      expect((error as ShapeError).message).toContain('types.0.name');
      expect((error as ShapeError).message).toContain('/activity-types');
    }
  });

  it('says this is a bug to report rather than something to retry', () => {
    // A transport failure is worth retrying; a changed contract never is, and
    // an agent told to retry will keep trying.
    try {
      parseResponse(daysResponseSchema, '/days', { days: 'not a list' });
      throw new Error('should have thrown');
    } catch (error) {
      expect((error as Error).message).toMatch(/rather than something to retry/);
    }
  });

  it('tolerates fields it does not know about, so the API can add them', () => {
    const withExtra = {
      types: [{ ...fixtures.activityTypes.types[0], somethingNew: true }],
      brandNewTopLevelField: 42
    };

    expect(() => parseResponse(activityTypesResponseSchema, '/activity-types', withExtra)).not.toThrow();
  });
});
