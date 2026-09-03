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
      respond({ success: true, data: { activities: [{ _id: 'a1' }], pagination: {} } })
    );

    await expect(tumbaland.listActivities(KEY, {})).resolves.toHaveLength(1);
  });

  it('returns an empty list rather than throwing when the collection is absent', async () => {
    (global.fetch as jest.Mock).mockReturnValue(respond({ success: true, data: {} }));
    await expect(tumbaland.listActivityTypes(KEY)).resolves.toEqual([]);
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
