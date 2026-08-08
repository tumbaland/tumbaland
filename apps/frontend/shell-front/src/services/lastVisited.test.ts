import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getLastVisited, recordLastVisited } from './lastVisited';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

it('round-trips the last visited route', () => {
  recordLastVisited('/album/albums');
  expect(getLastVisited()).toBe('/album/albums');
});

it('returns null before anything is recorded', () => {
  expect(getLastVisited()).toBeNull();
});

it('stays silent when storage is unavailable', () => {
  // The test setup swaps in its own MemoryStorage instance, so the spy has to
  // go on that object rather than Storage.prototype.
  vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
    throw new Error('QuotaExceededError');
  });
  vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
    throw new Error('SecurityError');
  });

  expect(() => recordLastVisited('/finance/dashboard')).not.toThrow();
  expect(getLastVisited()).toBeNull();
});
