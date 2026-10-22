import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { act, renderHook } from '@testing-library/react';

const api = vi.hoisted(() => ({ listAlbums: vi.fn() }));
vi.mock('../services/chatApi', () => ({ chatApi: api }));

import { useThreadMedia } from './useThreadMedia';
import type { Attachment, ThreadMessage } from '../types';

const photo = (fileId: string, albumId: string | null = null): Attachment => ({
  fileId,
  mimetype: 'image/jpeg',
  sizeBytes: 1,
  albumId,
  albumName: albumId ? 'Rome' : null
});

const message = (id: string, attachments: Attachment[], overrides: Partial<ThreadMessage> = {}): ThreadMessage => ({
  id,
  conversationId: 'c1',
  senderId: 'u-tom',
  senderEmail: '',
  senderName: 'Tom',
  kind: 'media',
  body: '',
  attachments,
  replyTo: null,
  reactions: [],
  clientId: id,
  editedAt: null,
  deletedAt: null,
  createdAt: '2026-10-22T10:00:00.000Z',
  ...overrides
});

const thread = (messages: ThreadMessage[]) => ({
  messages,
  removeFromAlbum: vi.fn(async () => {}),
  placeInAlbum: vi.fn(async () => {}),
  setAppearance: vi.fn(async () => {})
});

beforeEach(() => api.listAlbums.mockReset().mockResolvedValue([]));

describe('useThreadMedia', () => {
  it('goes straight to the albums for one photo, and asks which first for several', () => {
    const given = thread([message('one', [photo('a')]), message('two', [photo('a'), photo('b')])]);
    const { result } = renderHook(() => useThreadMedia({ conversationId: 'c1', thread: given, onError: vi.fn() }));

    act(() => result.current.editAlbum('one'));
    expect(result.current.albumPicker.open).toBe(true);
    act(() => result.current.albumPicker.onClose());

    act(() => result.current.editAlbum('two'));
    expect(result.current.photoSelection.open).toBe(true);
    expect(result.current.photoSelection.title).toBe('Which photos?');
    expect(result.current.photoSelection.confirmLabel(2)).toBe('Next (2)');
    expect(result.current.photoSelection.confirmLabel(1)).toBe('Next');
  });

  it('moves some of the photos after choosing them', async () => {
    const given = thread([message('two', [photo('a', 'r'), photo('b', 'r')])]);
    const { result } = renderHook(() => useThreadMedia({ conversationId: 'c1', thread: given, onError: vi.fn() }));

    act(() => result.current.editAlbum('two'));
    await act(() => result.current.photoSelection.onConfirm(['b']));
    expect(result.current.albumPicker.open).toBe(true);
    expect(result.current.albumPicker.current).toMatchObject({ mode: 'album', albumId: 'r' });

    await act(() => result.current.albumPicker.onChoose({ mode: 'album', albumId: 'h' }));
    expect(given.placeInAlbum).toHaveBeenCalledWith('two', { albumId: 'h' }, ['b']);
    await act(() => result.current.albumPicker.onChoose({ mode: 'album', newAlbumName: 'Best' }));
    expect(given.placeInAlbum).toHaveBeenCalledWith('two', { newAlbumName: 'Best' }, ['b']);
    await act(() => result.current.albumPicker.onChoose({ mode: 'off' }));
    expect(given.removeFromAlbum).toHaveBeenCalledWith('two', ['b']);
    await act(() => result.current.albumPicker.loadAlbums());
    expect(api.listAlbums).toHaveBeenCalledWith('c1');
  });

  it('takes photos out at once for one, after choosing for several, and says when it fails', async () => {
    const onError = vi.fn();
    const given = thread([message('one', [photo('a', 'r')]), message('two', [photo('a', 'r'), photo('b', 'r')])]);
    given.removeFromAlbum.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useThreadMedia({ conversationId: 'c1', thread: given, onError }));

    await act(async () => result.current.removeAlbum('one'));
    expect(given.removeFromAlbum).toHaveBeenCalledWith('one');
    expect(onError).toHaveBeenCalledWith('Could not remove it from the album. Try again.');

    act(() => result.current.removeAlbum('two'));
    expect(result.current.photoSelection.title).toBe('Take which photos out?');
    expect(result.current.photoSelection.confirmLabel(2)).toBe('Take 2 out of the album');
    await act(() => result.current.photoSelection.onConfirm(['a', 'b']));
    expect(given.removeFromAlbum).toHaveBeenLastCalledWith('two', undefined);
    act(() => result.current.photoSelection.onClose());
  });

  it('opens the viewer on a photo, changes its album, and makes it the background', async () => {
    const given = thread([message('m', [photo('a'), photo('b')])]);
    const { result } = renderHook(() => useThreadMedia({ conversationId: 'c1', thread: given, onError: vi.fn() }));

    act(() => result.current.openMedia(given.messages[0]!, 1));
    expect(result.current.lightbox.index).toBe(1);

    act(() => result.current.lightbox.onEditAlbum?.(1));
    expect(result.current.albumPicker.open).toBe(true);

    await act(async () => result.current.lightbox.onUseAsBackground?.(0));
    expect(given.setAppearance).toHaveBeenCalledWith({ backgroundFileId: 'a' });
    expect(result.current.lightbox.index).toBeNull();
  });

  it('says so when the background cannot be set, and offers nothing on a message still sending', async () => {
    const onError = vi.fn();
    const given = thread([message('m', [photo('a')]), message('p', [photo('x')], { delivery: 'pending' })]);
    given.setAppearance.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useThreadMedia({ conversationId: 'c1', thread: given, onError }));

    act(() => result.current.openMedia(given.messages[0]!, 0));
    await act(async () => result.current.lightbox.onUseAsBackground?.(0));
    expect(onError).toHaveBeenCalledWith('Could not set that as the background. Try again.');

    act(() => result.current.openMedia(given.messages[1]!, 0));
    expect(result.current.lightbox.onEditAlbum).toBeUndefined();
    act(() => result.current.lightbox.onClose());
    expect(result.current.lightbox.index).toBeNull();
  });
});
