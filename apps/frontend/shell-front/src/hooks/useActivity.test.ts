import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { renderHook } from '@testing-library/react';

const recordVisit = vi.fn();
const recordOpen = vi.fn();
vi.mock('../services/activity', async () => {
  const actual = await vi.importActual<typeof import('../services/activity')>('../services/activity');
  return { ...actual, recordVisit: () => recordVisit(), recordOpen: (pathname: string) => recordOpen(pathname) };
});
vi.mock('../config/ConfigProvider', () => ({ getGlobalConfig: () => ({}) }));

import { AWAY_MS, useActivity } from './useActivity';

let visibility: DocumentVisibilityState = 'visible';

const setVisibility = (state: DocumentVisibilityState) => {
  visibility = state;
  document.dispatchEvent(new Event('visibilitychange'));
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-27T08:00:00Z'));
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { get: () => visibility, configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useActivity', () => {
  it('reports nothing while signed out', () => {
    renderHook(() => useActivity(false, '/'));

    expect(recordVisit).not.toHaveBeenCalled();
    expect(recordOpen).not.toHaveBeenCalled();
  });

  it('reports a visit and the page opened when someone is signed in', () => {
    renderHook(() => useActivity(true, '/album/albums'));

    expect(recordVisit).toHaveBeenCalledTimes(1);
    expect(recordOpen).toHaveBeenCalledTimes(1);
    expect(recordOpen).toHaveBeenCalledWith('/album/albums');
  });

  it('starts reporting when the session turns out to be signed in', () => {
    const { rerender } = renderHook(({ authenticated }) => useActivity(authenticated, '/'), {
      initialProps: { authenticated: false }
    });
    expect(recordVisit).not.toHaveBeenCalled();

    rerender({ authenticated: true });

    expect(recordVisit).toHaveBeenCalledTimes(1);
    expect(recordOpen).toHaveBeenCalledWith('/');
  });

  describe('page opens', () => {
    it('counts moving to another module', () => {
      const { rerender } = renderHook(({ path }) => useActivity(true, path), { initialProps: { path: '/' } });

      rerender({ path: '/album' });
      rerender({ path: '/relationship/journal' });

      expect(recordOpen.mock.calls.map(([path]) => path)).toEqual(['/', '/album', '/relationship/journal']);
    });

    it('does not count wandering inside one module', () => {
      const { rerender } = renderHook(({ path }) => useActivity(true, path), { initialProps: { path: '/album' } });

      rerender({ path: '/album/albums' });
      rerender({ path: '/album/albums/64f2/photos/abc' });
      rerender({ path: '/album/collages' });

      expect(recordOpen).toHaveBeenCalledTimes(1);
    });

    it('counts coming back to a module after another one', () => {
      const { rerender } = renderHook(({ path }) => useActivity(true, path), { initialProps: { path: '/album' } });

      rerender({ path: '/chat' });
      rerender({ path: '/album' });

      expect(recordOpen.mock.calls.map(([path]) => path)).toEqual(['/album', '/chat', '/album']);
    });

    it('does not count the shell’s documents', () => {
      const { rerender } = renderHook(({ path }) => useActivity(true, path), { initialProps: { path: '/privacy' } });
      expect(recordOpen).not.toHaveBeenCalled();

      rerender({ path: '/album' });
      rerender({ path: '/terms' });
      rerender({ path: '/album' });

      // Reading a document is leaving Album, so coming back to it is opening it again.
      expect(recordOpen.mock.calls.map(([path]) => path)).toEqual(['/album', '/album']);
    });

    it('counts the same module again after signing out and in', () => {
      const { rerender } = renderHook(({ authenticated }) => useActivity(authenticated, '/album'), {
        initialProps: { authenticated: true }
      });

      rerender({ authenticated: false });
      rerender({ authenticated: true });

      expect(recordOpen).toHaveBeenCalledTimes(2);
    });
  });

  describe('coming back to a tab', () => {
    it('is a new visit after half an hour away', () => {
      renderHook(() => useActivity(true, '/'));
      recordVisit.mockClear();

      setVisibility('hidden');
      vi.advanceTimersByTime(AWAY_MS);
      setVisibility('visible');

      expect(recordVisit).toHaveBeenCalledTimes(1);
    });

    it('is not, after a shorter absence', () => {
      renderHook(() => useActivity(true, '/'));
      recordVisit.mockClear();

      setVisibility('hidden');
      vi.advanceTimersByTime(AWAY_MS - 1);
      setVisibility('visible');

      expect(recordVisit).not.toHaveBeenCalled();
    });

    it('counts one visit per long absence, not one per return', () => {
      renderHook(() => useActivity(true, '/'));
      recordVisit.mockClear();

      setVisibility('hidden');
      vi.advanceTimersByTime(AWAY_MS);
      setVisibility('visible');
      setVisibility('visible');

      expect(recordVisit).toHaveBeenCalledTimes(1);
    });

    it('measures from when a page that opened in the background was hidden', () => {
      visibility = 'hidden';
      renderHook(() => useActivity(true, '/'));
      recordVisit.mockClear();

      vi.advanceTimersByTime(AWAY_MS);
      setVisibility('visible');

      expect(recordVisit).toHaveBeenCalledTimes(1);
    });

    it('stops listening when the person signs out', () => {
      const { rerender } = renderHook(({ authenticated }) => useActivity(authenticated, '/'), {
        initialProps: { authenticated: true }
      });
      rerender({ authenticated: false });
      recordVisit.mockClear();

      setVisibility('hidden');
      vi.advanceTimersByTime(AWAY_MS);
      setVisibility('visible');

      expect(recordVisit).not.toHaveBeenCalled();
    });
  });
});
