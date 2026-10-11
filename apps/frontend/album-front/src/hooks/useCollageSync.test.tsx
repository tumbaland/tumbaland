import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { AUTOSAVE_DELAY_MS, useCollageSync, UseCollageSyncOptions } from './useCollageSync';
import { CollageDoc } from '@tumbaland/collage-core';
import type { ServerChange } from '../components/collage/collageChanges';
import { useCollageEditor } from './useCollageEditor';

vi.mock('../services/collageService', () => ({
  collageService: { applyChanges: vi.fn() }
}));

import { collageService } from '../services/collageService';

const applyChanges = collageService.applyChanges as unknown as ReturnType<typeof vi.fn>;

const base: CollageDoc = {
  canvas: { width: 1600, height: 900 },
  background: '#fff',
  frameEnabled: false,
  frameColor: '#ffffff',
  photos: [{ id: 'a', photoId: 'p1', x: 0, y: 0, width: 10, height: 10, rotation: 0, caption: '' }],
  texts: []
};
const moved = (x: number): CollageDoc => ({ ...base, photos: [{ ...base.photos[0], x }] });

const setup = (initial: Partial<UseCollageSyncOptions> = {}) => {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook((props: UseCollageSyncOptions) => useCollageSync(props), {
    wrapper,
    initialProps: { collageId: 'c1', session: 's1', doc: base, paused: false, ...initial }
  });
};

/** Let the quiet period pass and the save settle. */
const settle = async (ms = AUTOSAVE_DELAY_MS) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  applyChanges.mockReset().mockResolvedValue({ revision: 1 });
});
afterEach(() => vi.useRealTimers());

describe('useCollageSync', () => {
  it('sends nothing for the collage as it was loaded', async () => {
    const { result } = setup();
    await settle();
    expect(applyChanges).not.toHaveBeenCalled();
    expect(result.current.status).toBe('saved');
  });

  it('sends only what changed, once edits pause', async () => {
    const { result, rerender } = setup();

    rerender({ collageId: 'c1', session: 's1', doc: moved(10), paused: false });
    rerender({ collageId: 'c1', session: 's1', doc: moved(20), paused: false });
    expect(result.current.status).toBe('saving');
    await settle();

    expect(applyChanges).toHaveBeenCalledTimes(1);
    expect(applyChanges).toHaveBeenCalledWith(
      'c1',
      [expect.objectContaining({ type: 'put', layer: 'photos', item: expect.objectContaining({ id: 'a', x: 20 }) })],
      's1'
    );
    expect(result.current.status).toBe('saved');
  });

  it('waits for a drag to end rather than saving where the photo happens to be', async () => {
    const { rerender } = setup();

    rerender({ collageId: 'c1', session: 's1', doc: moved(10), paused: true });
    await settle(5000);
    expect(applyChanges).not.toHaveBeenCalled();

    rerender({ collageId: 'c1', session: 's1', doc: moved(10), paused: false });
    await settle();
    expect(applyChanges).toHaveBeenCalledTimes(1);
  });

  it('saves straight away when a drag ends, without the usual pause', async () => {
    const { rerender } = setup();

    rerender({ collageId: 'c1', session: 's1', doc: moved(10), paused: true });
    rerender({ collageId: 'c1', session: 's1', doc: moved(10), paused: false });
    await settle(0);

    expect(applyChanges).toHaveBeenCalledTimes(1);
  });

  it('keeps trying after a failure, and then sends everything since the last save that worked', async () => {
    applyChanges.mockRejectedValueOnce(new Error('offline'));
    const { result, rerender } = setup();

    rerender({ collageId: 'c1', session: 's1', doc: moved(10), paused: false });
    await settle();
    expect(result.current.status).toBe('retrying');

    rerender({ collageId: 'c1', session: 's1', doc: moved(30), paused: false });
    await settle(2500);

    expect(applyChanges).toHaveBeenCalledTimes(2);
    expect(applyChanges).toHaveBeenLastCalledWith(
      'c1',
      [expect.objectContaining({ item: expect.objectContaining({ x: 30 }) })],
      's1'
    );
    expect(result.current.status).toBe('saved');
  });

  it('stops saying "not saved" once a failed change is undone', async () => {
    applyChanges.mockRejectedValue(new Error('offline'));
    const { result, rerender } = setup();

    rerender({ collageId: 'c1', session: 's1', doc: moved(10), paused: false });
    await settle();
    expect(result.current.status).toBe('retrying');

    // Undo: back to exactly what the server has.
    rerender({ collageId: 'c1', session: 's1', doc: moved(0), paused: false });
    await settle(2500);

    expect(result.current.status).toBe('saved');
    let saved = false;
    await act(async () => {
      saved = await result.current.flush();
    });
    expect(saved).toBe(true);
  });

  it('saves straight away when asked, and says whether it worked', async () => {
    const { result, rerender } = setup();
    rerender({ collageId: 'c1', session: 's1', doc: moved(10), paused: false });

    let saved = false;
    await act(async () => {
      saved = await result.current.flush();
    });

    expect(saved).toBe(true);
    expect(applyChanges).toHaveBeenCalledTimes(1);
  });

  it('writes an older collage whole first, then goes on with small changes', async () => {
    const saveWhole = vi.fn().mockResolvedValue(undefined);
    const { rerender } = setup({ saveWhole });

    await settle(0);
    expect(saveWhole).toHaveBeenCalledWith(base);

    rerender({ collageId: 'c1', session: 's1', doc: moved(10), paused: false, saveWhole });
    await settle();
    expect(saveWhole).toHaveBeenCalledTimes(1);
    expect(applyChanges).toHaveBeenCalledTimes(1);
  });

  it('sends a change still waiting when the editor closes', async () => {
    const { rerender, unmount } = setup();
    rerender({ collageId: 'c1', session: 's1', doc: moved(10), paused: false });

    unmount();
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(applyChanges).toHaveBeenCalledTimes(1);
  });
});

/**
 * The editor and the sync together, as the page uses them, so incoming
 * changes go through the real rebase.
 */
function setupPair(fetchLatest = vi.fn()) {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(
    () => {
      const editor = useCollageEditor();
      useEffect(() => {
        if (!editor.doc) editor.init(base);
      }, [editor]);
      const sync = useCollageSync({
        collageId: 'c1',
        session: 's1',
        doc: editor.doc,
        revision: 3,
        paused: editor.gestureActive,
        onIncoming: editor.applyIncoming,
        fetchLatest
      });
      return { editor, sync };
    },
    { wrapper }
  );
}

const putA = (x: number): ServerChange[] => [
  { type: 'put', layer: 'photos', item: { ...base.photos[0], x } as unknown as { id: string } }
];
const photoB = { id: 'b', photoId: 'p2', x: 5, y: 5, width: 10, height: 10, rotation: 0, caption: '' };

describe('changes from someone else', () => {
  it('show up here, and are not sent back', async () => {
    const { result } = setupPair();
    await settle(0);

    act(() => result.current.sync.receive(4, putA(77)));
    await settle();

    expect(result.current.editor.doc?.photos[0].x).toBe(77);
    expect(applyChanges).not.toHaveBeenCalled();
    expect(result.current.editor.canUndo).toBe(false);
    // Nothing of ours to save, so no "Saving…" flicker either.
    expect(result.current.sync.status).toBe('saved');
  });

  it('leave an unsaved edit of yours on top, and only yours is sent', async () => {
    const { result } = setupPair();
    await settle(0);
    act(() => {
      result.current.editor.addPhoto({ ...photoB });
    });

    act(() => result.current.sync.receive(4, putA(77)));
    await settle();

    expect(result.current.editor.doc?.photos.map((p) => p.x)).toEqual([77, 5]);
    expect(applyChanges).toHaveBeenCalledTimes(1);
    const [, sent] = applyChanges.mock.calls[0]!;
    expect(sent).toEqual([expect.objectContaining({ type: 'put', item: expect.objectContaining({ photoId: 'p2' }) })]);
  });

  it('win over a save of yours that the server applied before theirs', async () => {
    let answer: (value: { revision: number }) => void = () => undefined;
    applyChanges.mockImplementation(() => new Promise((resolve) => (answer = resolve)));
    const { result } = setupPair();
    await settle(0);

    act(() => result.current.editor.patchItem('a', { x: 10 }));
    await settle(); // our save is now on its way
    act(() => result.current.sync.receive(5, putA(99))); // theirs, stored after ours
    await act(async () => answer({ revision: 4 }));
    await settle();

    expect(result.current.editor.doc?.photos[0].x).toBe(99);
    expect(applyChanges).toHaveBeenCalledTimes(1);
  });

  it('lose to a save of yours that the server applied after theirs', async () => {
    let answer: (value: { revision: number }) => void = () => undefined;
    applyChanges.mockImplementation(() => new Promise((resolve) => (answer = resolve)));
    const { result } = setupPair();
    await settle(0);

    act(() => result.current.editor.patchItem('a', { x: 10 }));
    await settle();
    act(() => result.current.sync.receive(4, putA(99))); // theirs, stored before ours
    await act(async () => answer({ revision: 5 }));
    await settle();

    expect(result.current.editor.doc?.photos[0].x).toBe(10);
    expect(applyChanges).toHaveBeenCalledTimes(1);
  });

  it('show "Saved" as soon as a save that crossed theirs is in, with no extra save', async () => {
    let answer: (value: { revision: number }) => void = () => undefined;
    applyChanges.mockImplementation(() => new Promise((resolve) => (answer = resolve)));
    const { result } = setupPair();
    await settle(0);
    act(() => {
      result.current.editor.addPhoto({ ...photoB });
    });
    await settle();
    act(() => result.current.sync.receive(4, putA(99)));

    await act(async () => answer({ revision: 5 }));
    await settle(0);

    expect(result.current.sync.status).toBe('saved');
    await settle(AUTOSAVE_DELAY_MS);
    expect(applyChanges).toHaveBeenCalledTimes(1);
  });

  it('are ignored when they are already in', async () => {
    const { result } = setupPair();
    await settle(0);

    act(() => result.current.sync.receive(3, putA(77)));

    expect(result.current.editor.doc?.photos[0].x).toBe(0);
  });

  it('fetch the collage whole when the server is ahead of what arrived', async () => {
    const fetchLatest = vi.fn().mockResolvedValue({ doc: moved(42), revision: 9 });
    const { result } = setupPair(fetchLatest);
    await settle(0);

    act(() => result.current.sync.checkRevision(9));
    await settle();

    expect(fetchLatest).toHaveBeenCalledTimes(1);
    expect(result.current.editor.doc?.photos[0].x).toBe(42);
    expect(applyChanges).not.toHaveBeenCalled();
  });

  it('fetch the collage whole when theirs turns up after a later save of yours', async () => {
    applyChanges.mockResolvedValue({ revision: 5 });
    const fetchLatest = vi.fn().mockResolvedValue({ doc: moved(10), revision: 5 });
    const { result } = setupPair(fetchLatest);
    await settle(0);
    act(() => result.current.editor.patchItem('a', { x: 10 }));
    await settle();

    // Stored before ours, delivered after: it cannot simply go on top.
    act(() => result.current.sync.receive(4, putA(99)));
    await settle();

    expect(fetchLatest).toHaveBeenCalledTimes(1);
    expect(result.current.editor.doc?.photos[0].x).toBe(10);
  });

  it('do not fetch when nothing was missed', async () => {
    const fetchLatest = vi.fn();
    const { result } = setupPair(fetchLatest);
    await settle(0);

    act(() => result.current.sync.checkRevision(3));

    expect(fetchLatest).not.toHaveBeenCalled();
  });
});
