import { describe, expect, it, vi } from 'vite-plus/test';
import { act, renderHook } from '@testing-library/react';

vi.mock('./useDriveShare', () => ({ useDriveShare: () => ({ state: 'idle' }) }));
const preload = vi.hoisted(() => vi.fn());
vi.mock('../components/live/loadLiveMap', () => ({ preloadLiveMap: preload }));

import { useThreadLocation } from './useThreadLocation';
import type { LiveShare } from '../types';

const share = (userId: string) => ({ userId }) as LiveShare;
const member = (userId: string, name: string, email = '') => ({ userId, name, email, joinedAt: '' });

describe('useThreadLocation', () => {
  it('opens the map, starting to load it, and finds whose shares are whose', () => {
    const setLiveShare = vi.fn();
    const { result } = renderHook(() =>
      useThreadLocation('c1', 'u-tom', {
        live: [share('u-tom'), share('u-irja')],
        members: [member('u-tom', 'Tom'), member('u-irja', 'Irja')],
        setLiveShare
      })
    );

    act(() => result.current.openMap());
    expect(result.current.open).toBe(true);
    expect(preload).toHaveBeenCalled();
    expect(result.current.ownShare?.userId).toBe('u-tom');
    expect(result.current.audience).toBe('Irja');

    act(() => result.current.watch('u-irja'));
    expect(result.current.watchedShare?.userId).toBe('u-irja');
    act(() => result.current.closeViewer());
    expect(result.current.watchedShare).toBeNull();

    act(() => result.current.updateShare(share('u-irja')));
    expect(setLiveShare).toHaveBeenCalledWith('u-irja', share('u-irja'));
    act(() => result.current.closeMap());
    expect(result.current.open).toBe(false);
  });

  it('closes everything when another conversation opens, and names a group without names by email', () => {
    const thread = { live: [], members: [member('u-tom', 'Tom'), member('u-x', '', 'x@example.com')], setLiveShare: vi.fn() };
    const { result, rerender } = renderHook(({ id }) => useThreadLocation(id, 'u-tom', thread), {
      initialProps: { id: 'c1' }
    });
    act(() => result.current.openMap());

    rerender({ id: 'c2' });

    expect(result.current.open).toBe(false);
    expect(result.current.audience).toBe('x@example.com');
  });

  it('calls a conversation with nobody else in it "The others"', () => {
    const { result } = renderHook(() =>
      useThreadLocation('c1', 'u-tom', { live: [], members: [], setLiveShare: vi.fn() })
    );
    expect(result.current.audience).toBe('The others');
  });
});
