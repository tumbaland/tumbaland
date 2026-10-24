import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { act, render } from '@testing-library/react';

// Leaflet's map needs a layout box jsdom cannot give it, and MapLibre needs
// WebGL. Both are stood in for by what this component does with them.
const map = vi.hoisted(() => ({ setMaxZoom: vi.fn() }));
vi.mock('react-leaflet', () => ({ useMap: () => map }));
const tiles = vi.hoisted(() => ({ addTo: vi.fn(), remove: vi.fn() }));
vi.mock('leaflet', () => ({ default: { tileLayer: vi.fn(() => tiles) } }));
const load = vi.hoisted(() => ({ loadMapLibre: vi.fn() }));
vi.mock('./loadMapLibre', () => load);

import L from 'leaflet';
import { FALLBACK_TILE_URL, MAP_ATTRIBUTION, MAP_STYLE, MapTiles } from './MapTiles';

const vector = { addTo: vi.fn(), remove: vi.fn() };
const maplibreGL = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  tiles.addTo.mockReturnValue(tiles);
  vector.addTo.mockReturnValue(vector);
  maplibreGL.mockReturnValue(vector);
  load.loadMapLibre.mockResolvedValue(maplibreGL);
});

const settle = () => act(async () => {});

describe('MapTiles', () => {
  it('draws OpenFreeMap with MapLibre, crediting it in the map’s own attribution', async () => {
    render(<MapTiles />);
    await settle();

    expect(maplibreGL).toHaveBeenCalledWith({
      style: MAP_STYLE,
      attributionControl: { customAttribution: MAP_ATTRIBUTION }
    });
    expect(vector.addTo).toHaveBeenCalledWith(map);
    expect(MAP_STYLE).toBe('https://tiles.openfreemap.org/styles/liberty');
    expect(MAP_ATTRIBUTION).toContain('OpenFreeMap');
    expect(MAP_ATTRIBUTION).toContain('OpenStreetMap');
    expect(map.setMaxZoom).toHaveBeenCalledWith(19);
    expect(L.tileLayer).not.toHaveBeenCalled();
  });

  it('falls back to the stock tiles when MapLibre cannot be loaded', async () => {
    load.loadMapLibre.mockRejectedValue(new Error('offline'));
    render(<MapTiles />);
    await settle();

    expect(L.tileLayer).toHaveBeenCalledWith(FALLBACK_TILE_URL, expect.objectContaining({ maxZoom: 19 }));
    expect(tiles.addTo).toHaveBeenCalledWith(map);
  });

  it('falls back to the stock tiles on a phone without WebGL', async () => {
    vector.addTo.mockImplementation(() => {
      throw new Error('Failed to initialize WebGL');
    });
    render(<MapTiles />);
    await settle();

    expect(tiles.addTo).toHaveBeenCalledWith(map);
  });

  it('takes its layer away with the map', async () => {
    const { unmount } = render(<MapTiles />);
    await settle();
    unmount();

    expect(vector.remove).toHaveBeenCalled();
  });

  it('adds nothing when the map closed before MapLibre arrived', async () => {
    let arrive!: (value: typeof maplibreGL) => void;
    load.loadMapLibre.mockReturnValue(new Promise((resolve) => (arrive = resolve)));
    const { unmount } = render(<MapTiles />);
    unmount();
    await act(async () => arrive(maplibreGL));

    expect(maplibreGL).not.toHaveBeenCalled();
    expect(L.tileLayer).not.toHaveBeenCalled();
  });

  it('adds no fallback when the map closed before loading failed', async () => {
    let fail!: (error: Error) => void;
    load.loadMapLibre.mockReturnValue(new Promise((_, reject) => (fail = reject)));
    const { unmount } = render(<MapTiles />);
    unmount();
    await act(async () => fail(new Error('offline')));

    expect(L.tileLayer).not.toHaveBeenCalled();
  });
});
