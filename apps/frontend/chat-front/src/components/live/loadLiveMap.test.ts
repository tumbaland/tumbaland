import { describe, expect, it, vi } from 'vite-plus/test';

vi.mock('./LiveMap', () => ({ default: () => null }));

describe('loadLiveMap', () => {
  it('loads the map once, however often it is asked for', async () => {
    const { loadLiveMap, preloadLiveMap } = await import('./loadLiveMap');
    preloadLiveMap();
    const first = loadLiveMap();
    expect(loadLiveMap()).toBe(first);
    expect((await first).default).toBeTypeOf('function');
  });
});
