import { beforeEach, expect, it, vi } from 'vite-plus/test';

const maplibre = vi.hoisted(() => ({ setWorkerUrl: vi.fn() }));
vi.mock('maplibre-gl', () => maplibre);
const bridge = vi.hoisted(() => ({ maplibreGL: vi.fn() }));
vi.mock('@maplibre/maplibre-gl-leaflet', () => bridge);

const styles = () => document.head.querySelectorAll('style[data-maplibre-styles]');

async function fresh() {
  // It loads once per page and remembers it did.
  vi.resetModules();
  return (await import('./loadMapLibre')).loadMapLibre;
}

beforeEach(() => {
  maplibre.setWorkerUrl.mockReset();
  styles().forEach((node) => node.remove());
});

it('hands back the Leaflet bridge, with the worker at an absolute address and the styles in the page', async () => {
  const load = await fresh();

  expect(await load()).toBe(bridge.maplibreGL);
  const workerUrl = maplibre.setWorkerUrl.mock.calls[0]![0] as string;
  // Absolute, so the shell framing this app does not resolve it against its own origin.
  expect(workerUrl).toMatch(/^(https?|file):\/\/.*maplibre-gl-worker/);
  expect(styles()).toHaveLength(1);
});

it('loads once, however many maps ask, and adds the styles once', async () => {
  const load = await fresh();

  await Promise.all([load(), load()]);
  await load();

  expect(maplibre.setWorkerUrl).toHaveBeenCalledTimes(1);
  expect(styles()).toHaveLength(1);
});

it('tries again after a failed load', async () => {
  const load = await fresh();
  maplibre.setWorkerUrl.mockImplementationOnce(() => {
    throw new Error('offline');
  });

  await expect(load()).rejects.toThrow('offline');
  expect(await load()).toBe(bridge.maplibreGL);
});
