import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import {
  ageText,
  currentPosition,
  distanceBetween,
  formatDistance,
  keepScreenOn,
  kmh,
  positionError,
  toLivePosition
} from './live';

afterEach(() => vi.unstubAllGlobals());

describe('wording', () => {
  it.each([
    [4, '10 m'],
    [873, '870 m'],
    [3240, '3.2 km'],
    [14_600, '15 km']
  ])('writes %i m as %s', (metres, text) => {
    expect(formatDistance(metres)).toBe(text);
  });

  it('says how old a position is', () => {
    const now = Date.parse('2026-10-22T18:00:00Z');
    expect(ageText(now - 3_000, now)).toBe('just now');
    expect(ageText(now - 40_000, now)).toBe('40 s ago');
    expect(ageText(now - 3 * 60_000, now)).toBe('3 min ago');
    expect(ageText(now - 65 * 60_000, now)).toBe('1 h 5 min ago');
  });

  it('gives a speed in km/h', () => {
    expect(kmh(13.9)).toBe(50);
  });

  it('explains why there is no position', () => {
    expect(positionError({ code: 1 })).toMatch(/blocked/);
    expect(positionError({ code: 3 })).toMatch(/in time/);
    expect(positionError({ code: 2 })).toBe('Could not find where you are.');
  });
});

describe('distanceBetween', () => {
  it('measures along the surface of the Earth', () => {
    const metres = distanceBetween({ lat: 59.437, lng: 24.7536 }, { lat: 59.437, lng: 24.773 });
    expect(metres).toBeGreaterThan(1050);
    expect(metres).toBeLessThan(1150);
  });
});

describe('toLivePosition', () => {
  it('keeps what the server stores, rounded', () => {
    const coords = {
      latitude: 59.4,
      longitude: 24.7,
      accuracy: 7.6,
      heading: 91.4,
      speed: 13.94
    } as GeolocationCoordinates;
    expect(toLivePosition(coords)).toEqual({ lat: 59.4, lng: 24.7, accuracy: 8, heading: 91, speed: 13.9 });
  });

  it('leaves out heading and speed while standing still', () => {
    const coords = {
      latitude: 59.4,
      longitude: 24.7,
      accuracy: 20,
      heading: null,
      speed: null
    } as GeolocationCoordinates;
    expect(toLivePosition(coords)).toMatchObject({ heading: null, speed: null });
  });
});

describe('currentPosition', () => {
  it('allows a quick cached fix for the map picker without changing live tracking defaults', async () => {
    const getCurrentPosition = vi.fn((ok: (position: unknown) => void) =>
      ok({ coords: { latitude: 1, longitude: 2 } })
    );
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
    await currentPosition({ enableHighAccuracy: false, maximumAge: 60_000, timeout: 8_000 });
    expect(getCurrentPosition).toHaveBeenLastCalledWith(expect.any(Function), expect.any(Function), {
      enableHighAccuracy: false,
      maximumAge: 60_000,
      timeout: 8_000
    });
    await currentPosition();
    expect(getCurrentPosition).toHaveBeenLastCalledWith(expect.any(Function), expect.any(Function), {
      enableHighAccuracy: true,
      maximumAge: 30_000,
      timeout: 20_000
    });
  });
  it('answers with where the phone is', async () => {
    const position = { coords: { latitude: 1, longitude: 2 } };
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: (ok: (p: unknown) => void) => ok(position) } });
    await expect(currentPosition()).resolves.toBe(position);
  });

  it('says so in words when the person blocked it', async () => {
    vi.stubGlobal('navigator', {
      geolocation: { getCurrentPosition: (_ok: unknown, fail: (e: unknown) => void) => fail({ code: 1 }) }
    });
    await expect(currentPosition()).rejects.toThrow(/blocked/);
  });

  it('says so when the browser has no location at all', async () => {
    vi.stubGlobal('navigator', {});
    await expect(currentPosition()).rejects.toThrow(/cannot tell/);
  });
});

describe('keepScreenOn', () => {
  it('asks for the screen to stay on', async () => {
    const sentinel = { release: vi.fn() };
    vi.stubGlobal('navigator', { wakeLock: { request: vi.fn().mockResolvedValue(sentinel) } });
    await expect(keepScreenOn()).resolves.toBe(sentinel);
  });

  it('is null where the browser will not', async () => {
    vi.stubGlobal('navigator', {});
    await expect(keepScreenOn()).resolves.toBeNull();
    vi.stubGlobal('navigator', { wakeLock: { request: vi.fn().mockRejectedValue(new Error('low battery')) } });
    await expect(keepScreenOn()).resolves.toBeNull();
  });
});
