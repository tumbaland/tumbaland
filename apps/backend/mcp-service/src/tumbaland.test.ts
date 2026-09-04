jest.mock('@tumbaland/backend-core', () => ({
  requireEnv: (name: string) => process.env[name] ?? 'http://relationship-service:4001'
}));

import { resolveType, tumbaland, TumbalandError, ActivityType } from './tumbaland';

const KEY = 'tmb_live_abcdef123456_secret';

const types: ActivityType[] = [
  { _id: 't1', name: 'Dinner', slug: 'dinner', valueType: 'string', hasLocation: true },
  { _id: 't2', name: 'Time together', slug: 'time-together', valueType: 'number', hasLocation: false }
];

const respond = (body: unknown, ok = true, status = 200) =>
  Promise.resolve({ ok, status, text: async () => JSON.stringify(body) } as Response);

beforeEach(() => {
  global.fetch = jest.fn() as unknown as typeof fetch;
});

describe('response unwrapping', () => {
  it('unwraps the named collection the list endpoints return', async () => {
    // The endpoint answers { data: { types: [...], pagination: {...} } }, not a
    // bare array — assuming otherwise produced "types.map is not a function"
    // against the live service.
    (global.fetch as jest.Mock).mockReturnValue(
      respond({ success: true, data: { types, pagination: { total: 2 } } })
    );

    await expect(tumbaland.listActivityTypes(KEY)).resolves.toEqual(types);
  });

  it('unwraps the activities collection the same way', async () => {
    (global.fetch as jest.Mock).mockReturnValue(
      respond({
        success: true,
        data: {
          activities: [{ _id: 'a1', date: '2026-09-04T00:00:00.000Z', typeId: 't1' }],
          pagination: {}
        }
      })
    );

    await expect(tumbaland.listActivities(KEY, {})).resolves.toHaveLength(1);
  });

  it('treats a missing collection as a changed contract, not an empty result', async () => {
    // Returning [] here was the original bug's quieter cousin: an endpoint that
    // stops sending `types` means something moved, and answering "you have no
    // activity types" would send the model off to tell the user so.
    (global.fetch as jest.Mock).mockReturnValue(respond({ success: true, data: {} }));
    await expect(tumbaland.listActivityTypes(KEY)).rejects.toThrow(/not the shape/);
  });
});

describe('authentication forwarding', () => {
  it("sends the caller's own key, so the request keeps their scope", async () => {
    (global.fetch as jest.Mock).mockReturnValue(respond({ success: true, data: { types } }));

    await tumbaland.listActivityTypes(KEY);

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers.Authorization).toBe(`Bearer ${KEY}`);
  });
});

describe('errors', () => {
  it('carries the service message and status through', async () => {
    (global.fetch as jest.Mock).mockReturnValue(
      respond({ success: false, message: 'missing scope' }, false, 403)
    );

    await expect(tumbaland.listActivityTypes(KEY)).rejects.toMatchObject({
      message: 'missing scope',
      status: 403
    });
  });

  it('falls back to the status when the body is not JSON', async () => {
    (global.fetch as jest.Mock).mockReturnValue(
      Promise.resolve({ ok: false, status: 502, text: async () => '<html>bad gateway</html>' } as Response)
    );

    await expect(tumbaland.listActivityTypes(KEY)).rejects.toMatchObject({ status: 502 });
  });
});

describe('resolveType', () => {
  it.each([['Dinner'], ['dinner'], ['DINNER'], ['  Dinner  ']])('matches %s by name', (name) => {
    expect(resolveType(types, name)._id).toBe('t1');
  });

  it('matches by slug too', () => {
    expect(resolveType(types, 'time-together')._id).toBe('t2');
  });

  it('names the real types on a miss, so the next attempt can succeed', () => {
    try {
      resolveType(types, 'brunch');
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(TumbalandError);
      expect((error as Error).message).toContain('Dinner');
      expect((error as Error).message).toContain('Time together');
    }
  });

  it('says so plainly when no types exist at all', () => {
    expect(() => resolveType([], 'anything')).toThrow(/none defined yet/);
  });
});

describe('query parameter names', () => {
  // These are asserted by name because the API ignores unknown parameters
  // rather than rejecting them: a wrong name returns an unfiltered result that
  // looks like a correct one. Only an explicit assertion catches that.
  const paramsOf = (): URLSearchParams =>
    new URL((global.fetch as jest.Mock).mock.calls[0][0]).searchParams;

  it('filters activities with startDate/endDate, not from/to', async () => {
    (global.fetch as jest.Mock).mockReturnValue(respond({ success: true, data: { activities: [] } }));

    await tumbaland.listActivities(KEY, { startDate: '2026-09-01', endDate: '2026-09-04' });

    const params = paramsOf();
    expect(params.get('startDate')).toBe('2026-09-01');
    expect(params.get('endDate')).toBe('2026-09-04');
    expect(params.get('from')).toBeNull();
    expect(params.get('to')).toBeNull();
  });

  it('filters activities by activityType slug, not typeId', async () => {
    (global.fetch as jest.Mock).mockReturnValue(respond({ success: true, data: { activities: [] } }));

    await tumbaland.listActivities(KEY, { activityType: 'dining' });

    expect(paramsOf().get('activityType')).toBe('dining');
    expect(paramsOf().get('typeId')).toBeNull();
  });

  it('reads a single day with startDate/endDate too', async () => {
    // getDay feeds the additive log_day: if this filter is ignored the merge
    // silently finds nothing and the save turns destructive again.
    (global.fetch as jest.Mock).mockReturnValue(
      respond({
        success: true,
        data: { days: [{ date: '2026-09-04', entries: [{ _id: 'e1', typeId: 't1' }] }] }
      })
    );

    const entries = await tumbaland.getDay(KEY, '2026-09-04');

    const params = paramsOf();
    expect(params.get('startDate')).toBe('2026-09-04');
    expect(params.get('endDate')).toBe('2026-09-04');
    expect(entries).toHaveLength(1);
  });

  it('returns no entries for a day that is not in the response', async () => {
    (global.fetch as jest.Mock).mockReturnValue(
      respond({
        success: true,
        data: { days: [{ date: '2026-09-01', entries: [{ _id: 'e1', typeId: 't1' }] }] }
      })
    );

    await expect(tumbaland.getDay(KEY, '2026-09-04')).resolves.toEqual([]);
  });
});

describe('endpoint paths', () => {
  // Asserted explicitly because a wrong path or verb fails the same way a wrong
  // query parameter did: quietly, with a plausible-looking answer.
  const requestOf = () => {
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    return { url: new URL(url as string), init: init as RequestInit };
  };

  beforeEach(() => {
    (global.fetch as jest.Mock).mockReturnValue(respond({ success: true, data: {} }));
  });

  it('creates an activity by POST to /activities', async () => {
    await tumbaland.createActivity(KEY, { date: '2026-09-04', typeId: 't1' });

    const { url, init } = requestOf();
    expect(url.pathname).toBe('/api/activities');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toMatchObject({ typeId: 't1' });
  });

  it('saves a day by PUT to that day’s path', async () => {
    await tumbaland.saveDay(KEY, '2026-09-04', [{ typeId: 't1' }]);

    const { url, init } = requestOf();
    expect(url.pathname).toBe('/api/days/2026-09-04');
    expect(init.method).toBe('PUT');
  });

  it('reads statistics with the timeframe', async () => {
    await tumbaland.getStatistics(KEY, 'month');

    const { url } = requestOf();
    expect(url.pathname).toBe('/api/statistics');
    expect(url.searchParams.get('timeframe')).toBe('month');
  });

  it('reads trends with the window', async () => {
    await tumbaland.getTrends(KEY, 7);

    const { url } = requestOf();
    expect(url.pathname).toBe('/api/statistics/trends');
    expect(url.searchParams.get('window')).toBe('7');
  });

  it('omits an absent window rather than sending "undefined"', async () => {
    await tumbaland.getTrends(KEY);
    expect(requestOf().url.searchParams.has('window')).toBe(false);
  });

  it('lists activity types from /activity-types', async () => {
    (global.fetch as jest.Mock).mockReturnValue(respond({ success: true, data: { types: [] } }));

    await tumbaland.listActivityTypes(KEY);

    expect(requestOf().url.pathname).toBe('/api/activity-types');
  });
});
