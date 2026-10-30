import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ChatEvent, Message } from '../types';

const api = {
  listMessages: vi.fn(),
  getConversation: vi.fn(),
  markRead: vi.fn(),
  sendMessage: vi.fn(),
  toggleReaction: vi.fn(),
  editMessage: vi.fn(),
  deleteMessage: vi.fn(),
  setPhotoAlbum: vi.fn(),
  startCollage: vi.fn(),
  setAppearance: vi.fn(),
  removeFromAlbum: vi.fn(),
  placeInAlbum: vi.fn(),
  sendTyping: vi.fn(),
  listLive: vi.fn(),
  getAssistants: vi.fn()
};
let streamHandlers: { onEvent: (event: ChatEvent) => void; onResync: () => void; onStateChange: (s: string) => void };
const warn = vi.fn();

vi.mock('../services/chatApi', () => ({
  chatApi: new Proxy(
    {},
    {
      get:
        (_target, name: string) =>
        (...args: unknown[]) =>
          api[name as keyof typeof api](...args)
    }
  ),
  newClientId: () => 'client-x'
}));
vi.mock('./useChatStream', () => ({
  useChatStream: (handlers: typeof streamHandlers) => {
    streamHandlers = handlers;
  }
}));
vi.mock('@tumbaland/frontend-core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tumbaland/frontend-core')>()),
  logger: { warn: (...args: unknown[]) => warn(...args), info: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import { useChatThread } from './useChatThread';

const message = (n: number, overrides: Partial<Message> = {}): Message => ({
  id: `m${n}`,
  conversationId: 'c1',
  senderId: 'u-irja',
  senderEmail: '',
  senderName: 'Irja',
  kind: 'text',
  body: `message ${n}`,
  attachments: [],
  replyTo: null,
  reactions: [],
  clientId: `client-${n}`,
  editedAt: null,
  deletedAt: null,
  createdAt: new Date(Date.UTC(2026, 0, 1, 0, n)).toISOString(),
  ...overrides
});

const detail = {
  id: 'c1',
  title: 'Us',
  members: [{ userId: 'u-irja', email: 'irja@test', name: 'Irja', joinedAt: '2026-01-01T00:00:00Z' }],
  reads: [
    { userId: 'u-irja', lastReadMessageId: 'm1', lastReadAt: '2026-01-01T00:01:00Z' },
    { userId: 'u-tom', lastReadMessageId: 'm2', lastReadAt: '2026-01-01T00:02:00Z' }
  ],
  presence: [{ userId: 'u-irja', online: true }],
  photoAlbum: { mode: 'album', albumId: 'a1', albumName: 'Trip' },
  appearance: { theme: 'sunset', backgroundFileId: null, backgroundUrl: null }
};

const event = (type: string, payload: unknown, conversationId: string | undefined = 'c1'): ChatEvent =>
  ({ type, conversationId, at: Date.UTC(2026, 0, 1, 1, 0), payload }) as ChatEvent;

/** `null` opens the hook with no conversation selected. */
async function openThread(conversationId: string | null = 'c1') {
  const hook = renderHook(() => useChatThread(conversationId ?? undefined, 'u-tom'));
  if (conversationId) await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

const emit = (e: ChatEvent) => act(() => streamHandlers.onEvent(e));

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  warn.mockReset();
  api.listMessages.mockResolvedValue({ messages: [message(2), message(1)], nextCursor: 'cursor-1' });
  api.getConversation.mockResolvedValue(detail);
  api.markRead.mockResolvedValue(undefined);
  api.sendTyping.mockResolvedValue(undefined);
  api.listLive.mockResolvedValue([]);
  api.getAssistants.mockResolvedValue(null);
});

describe('opening a conversation', () => {
  it('shows who is in it, how far each has read, and how it looks', async () => {
    const { result } = await openThread();

    await waitFor(() => expect(result.current.title).toBe('Us'));
    expect(result.current.members).toHaveLength(1);
    // The caller's own marker is never shown to them.
    expect(Object.keys(result.current.reads)).toEqual(['u-irja']);
    expect(result.current.presence['u-irja']).toMatchObject({ online: true });
    expect(result.current.photoAlbum).toMatchObject({ albumId: 'a1' });
    expect(result.current.appearance.theme).toBe('sunset');
    expect(result.current.hasOlder).toBe(true);
  });

  it('falls back to plain defaults for details the service leaves out', async () => {
    api.getConversation.mockResolvedValue({ id: 'c1', members: [], reads: [] });

    const { result } = await openThread();

    await waitFor(() => expect(api.getConversation).toHaveBeenCalled());
    expect(result.current.title).toBe('');
    expect(result.current.photoAlbum.mode).toBe('unset');
    expect(result.current.appearance.theme).toBe('classic');
  });

  it('is readable even when the details cannot be loaded', async () => {
    api.getConversation.mockRejectedValue(new Error('no details'));

    const { result } = await openThread();

    await waitFor(() =>
      expect(warn).toHaveBeenCalledWith('Could not load conversation details', { error: 'no details' })
    );
    expect(result.current.messages).toHaveLength(2);
  });

  it('shows the error when the messages cannot be loaded', async () => {
    api.listMessages.mockRejectedValue(new Error('offline'));

    const { result } = await openThread();

    expect(result.current.error).toBe('offline');
  });

  it('loads nothing without a conversation, and every action does nothing', async () => {
    const { result } = await openThread(null);

    await act(async () => {
      await result.current.send('hi');
      await result.current.retry('x');
      await result.current.react('m1', '❤️');
      await result.current.edit('m1', 'x');
      await result.current.remove('m1');
      await result.current.setPhotoAlbum({ mode: 'none' } as never);
      await result.current.setAppearance({ theme: 'x' });
      await result.current.removeFromAlbum('m1');
      await result.current.placeInAlbum('m1', { albumId: 'a' } as never);
      await result.current.loadOlder();
      expect(await result.current.startCollage('t', 'k')).toBeNull();
      expect(await result.current.loadUntil('m1', message(1).createdAt)).toBe('gone');
      result.current.notifyTyping();
    });

    expect(api.listMessages).not.toHaveBeenCalled();
    expect(api.sendMessage).not.toHaveBeenCalled();
    expect(api.sendTyping).not.toHaveBeenCalled();
  });

  it('loads an older page and puts it above what is shown', async () => {
    api.listMessages
      .mockResolvedValueOnce({ messages: [message(2)], nextCursor: 'cursor-1' })
      .mockResolvedValueOnce({ messages: [message(1)], nextCursor: null });
    const { result } = await openThread();

    await act(() => result.current.loadOlder());

    expect(api.listMessages).toHaveBeenLastCalledWith('c1', { before: 'cursor-1', limit: 50 });
    expect(result.current.messages.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(result.current.hasOlder).toBe(false);
  });

  it('shows the error when an older page cannot be loaded', async () => {
    api.listMessages
      .mockResolvedValueOnce({ messages: [message(2)], nextCursor: 'cursor-1' })
      .mockRejectedValueOnce(new Error('older failed'));
    const { result } = await openThread();

    await act(() => result.current.loadOlder());

    expect(result.current.error).toBe('older failed');
  });

  it('reloads when the stream says it missed something', async () => {
    const { result } = await openThread();

    await act(async () => streamHandlers.onResync());

    expect(api.listMessages).toHaveBeenCalledTimes(2);
    expect(result.current.loading).toBe(false);
  });

  it('shows the connection state the stream reports', async () => {
    const { result } = await openThread();

    act(() => streamHandlers.onStateChange('reconnecting'));

    expect(result.current.connection).toBe('reconnecting');
  });
});

describe('events from the stream', () => {
  it('adds a new message, ends its sender’s typing, and counts it as read by them', async () => {
    const { result } = await openThread();
    await emit(event('typing', { userId: 'u-irja', name: 'Irja' }));
    expect(result.current.typingNames).toEqual(['Irja']);

    await emit(event('message.created', message(3)));

    expect(result.current.messages.map((m) => m.id)).toContain('m3');
    expect(result.current.typingNames).toEqual([]);
    expect(result.current.reads['u-irja']).toMatchObject({ lastReadMessageId: 'm3' });
  });

  it('does not count the caller’s own message as a read by someone else', async () => {
    const { result } = await openThread();
    const before = result.current.reads;

    await emit(event('message.created', message(3, { senderId: 'u-tom' })));

    expect(Object.keys(result.current.reads)).toEqual(Object.keys(before));
    expect(result.current.reads['u-tom']).toBeUndefined();
  });

  it('applies an edit and a reaction to the message they are about', async () => {
    const { result } = await openThread();

    await emit(event('message.updated', message(2, { body: 'edited' })));
    expect(result.current.messages.find((m) => m.id === 'm2')?.body).toBe('edited');

    await emit(
      event(
        'reaction.updated',
        message(2, { body: 'edited', reactions: [{ emoji: '❤️', userIds: ['u-irja'] }] as never })
      )
    );
    expect(result.current.messages.find((m) => m.id === 'm2')?.reactions).toHaveLength(1);
  });

  it('drops a message that was deleted', async () => {
    const { result } = await openThread();

    await emit(event('message.deleted', { id: 'm2' }));

    // Kept as a tombstone, so the thread can say it was removed.
    expect(result.current.messages.find((m) => m.id === 'm2')).toMatchObject({
      body: '',
      deletedAt: expect.any(String)
    });
  });

  it('follows a change of album and background', async () => {
    const { result } = await openThread();

    await emit(
      event('conversation.updated', {
        photoAlbum: { mode: 'album', albumId: 'a2', albumName: 'Home' },
        appearance: { theme: 'night', backgroundFileId: 'f1', backgroundUrl: 'u' }
      })
    );

    expect(result.current.photoAlbum.albumId).toBe('a2');
    expect(result.current.appearance.theme).toBe('night');
  });

  it('copes with an update that says nothing', async () => {
    const { result } = await openThread();

    await emit(event('conversation.updated', null));

    expect(result.current.title).toBe('Us');
  });

  it('tracks who is online, other than the caller', async () => {
    const { result } = await openThread();

    // Presence is about a person, so it arrives with no conversation at all.
    await emit(event('presence', { userId: 'u-sam', online: false }, undefined));
    await emit(event('presence', { userId: 'u-tom', online: true }, undefined));

    expect(result.current.presence['u-sam']).toMatchObject({ online: false });
    expect(result.current.presence['u-tom']).toBeUndefined();
  });

  it('shows someone typing, but not the caller', async () => {
    const { result } = await openThread();

    await emit(event('typing', { userId: 'u-tom', name: 'Tom' }));
    expect(result.current.typingNames).toEqual([]);

    await emit(event('typing', { userId: 'u-irja', name: 'Irja' }));
    expect(result.current.typingNames).toEqual(['Irja']);
  });

  it('moves someone’s read marker, with the time when the event has none', async () => {
    const { result } = await openThread();

    await emit(event('read', { userId: 'u-irja', lastReadMessageId: 'm2', lastReadAt: '2026-01-01T00:10:00Z' }));
    expect(result.current.reads['u-irja']).toMatchObject({
      lastReadMessageId: 'm2',
      lastReadAt: '2026-01-01T00:10:00Z'
    });

    await emit(event('read', { userId: 'u-irja', lastReadMessageId: 'm3' }));
    expect(result.current.reads['u-irja']?.lastReadAt).toBe(new Date(Date.UTC(2026, 0, 1, 1, 0)).toISOString());

    await emit(event('read', { userId: 'u-tom', lastReadMessageId: 'm3' }));
    expect(result.current.reads['u-tom']).toBeUndefined();
  });

  it('ignores events about another conversation, and ones it does not know', async () => {
    const { result } = await openThread();

    await emit(event('message.created', message(9, { conversationId: 'other' }), 'other'));
    await emit(event('something.new', {}));

    expect(result.current.messages.some((m) => m.id === 'm9')).toBe(false);
  });
});

describe('sending', () => {
  it('shows a message at once, then swaps in the stored one', async () => {
    api.sendMessage.mockResolvedValue(message(3, { senderId: 'u-tom', clientId: 'client-x' }));
    const { result } = await openThread();

    await act(() => result.current.send('  hello  ', [], { effect: 'confetti' as never, skipAlbum: true }));

    expect(api.sendMessage).toHaveBeenCalledWith('c1', {
      clientId: 'client-x',
      body: 'hello',
      attachments: [],
      skipAlbum: true,
      effect: 'confetti'
    });
    const sent = result.current.messages.filter((m) => m.clientId === 'client-x');
    expect(sent).toHaveLength(1);
    expect(sent[0]?.delivery).toBe('sent');
  });

  it('names the photos that stay out of the album', async () => {
    api.sendMessage.mockResolvedValue(message(3, { kind: 'media', clientId: 'client-x' }));
    const { result } = await openThread();
    const attachments = ['f1', 'f2'].map((fileId) => ({ fileId, mimetype: 'image/jpeg', sizeBytes: 1 }));

    await act(() => result.current.send('', attachments, { skipAlbum: false, skipAlbumFileIds: ['f2'] }));

    expect(api.sendMessage).toHaveBeenCalledWith('c1', expect.objectContaining({ skipAlbumFileIds: ['f2'] }));
    expect(api.sendMessage.mock.calls[0]![1]).not.toHaveProperty('skipAlbum');
  });

  it('sends a message that is only a photo', async () => {
    api.sendMessage.mockResolvedValue(message(3, { kind: 'media', clientId: 'client-x' }));
    const { result } = await openThread();
    const attachment = { fileId: 'f1', mimetype: 'image/jpeg', sizeBytes: 1 };

    await act(() => result.current.send('   ', [attachment as never]));

    expect(api.sendMessage).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ body: '', attachments: [attachment] })
    );
  });

  it('sends nothing for an empty message', async () => {
    const { result } = await openThread();

    await act(() => result.current.send('   '));

    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('marks a send that failed, and retries it with the same id', async () => {
    api.sendMessage.mockRejectedValueOnce(new Error('offline'));
    const { result } = await openThread();
    await act(() => result.current.send('hello'));
    expect(result.current.messages.find((m) => m.clientId === 'client-x')?.delivery).toBe('failed');
    expect(warn).toHaveBeenCalledWith('Chat send failed', { error: 'offline' });

    api.sendMessage.mockResolvedValueOnce(message(3, { clientId: 'client-x' }));
    await act(() => result.current.retry('client-x'));

    expect(api.sendMessage).toHaveBeenCalledTimes(2);
    expect(api.sendMessage.mock.calls[1][1]).toMatchObject({ clientId: 'client-x', body: 'hello' });
    expect(result.current.messages.find((m) => m.clientId === 'client-x')?.delivery).toBe('sent');
  });

  it('has nothing to retry for a message it never queued', async () => {
    const { result } = await openThread();

    await act(() => result.current.retry('never-sent'));

    expect(api.sendMessage).not.toHaveBeenCalled();
  });
});

describe('changing messages', () => {
  it('reacts, and shows the updated message', async () => {
    api.toggleReaction.mockResolvedValue(message(2, { reactions: [{ emoji: '❤️', userIds: ['u-tom'] }] as never }));
    const { result } = await openThread();

    await act(() => result.current.react('m2', '❤️'));

    expect(api.toggleReaction).toHaveBeenCalledWith('c1', 'm2', '❤️');
    expect(result.current.messages.find((m) => m.id === 'm2')?.reactions).toHaveLength(1);
  });

  it('lets a failed reaction go with a note in the log', async () => {
    api.toggleReaction.mockRejectedValue(new Error('nope'));
    const { result } = await openThread();

    await act(() => result.current.react('m2', '❤️'));

    expect(warn).toHaveBeenCalledWith('Reaction failed', { error: 'nope' });
  });

  it('edits and removes a message', async () => {
    api.editMessage.mockResolvedValue(message(2, { body: 'new text' }));
    api.deleteMessage.mockResolvedValue(undefined);
    const { result } = await openThread();

    await act(() => result.current.edit('m2', 'new text'));
    expect(result.current.messages.find((m) => m.id === 'm2')?.body).toBe('new text');

    await act(() => result.current.remove('m2'));
    expect(api.deleteMessage).toHaveBeenCalledWith('c1', 'm2');
    expect(result.current.messages.find((m) => m.id === 'm2')).toMatchObject({
      body: '',
      deletedAt: expect.any(String)
    });
  });
});

describe('albums, collages and appearance', () => {
  it('chooses where photos go', async () => {
    api.setPhotoAlbum.mockResolvedValue({ mode: 'album', albumId: 'a3', albumName: 'New' });
    const { result } = await openThread();

    await act(() => result.current.setPhotoAlbum({ albumId: 'a3' } as never));

    expect(result.current.photoAlbum.albumId).toBe('a3');
  });

  it('changes how the thread looks', async () => {
    api.setAppearance.mockResolvedValue({ theme: 'forest', backgroundFileId: null, backgroundUrl: null });
    const { result } = await openThread();

    await act(() => result.current.setAppearance({ theme: 'forest' }));

    expect(api.setAppearance).toHaveBeenCalledWith('c1', { theme: 'forest' });
    expect(result.current.appearance.theme).toBe('forest');
  });

  it('starts a collage and shows its card', async () => {
    api.startCollage.mockResolvedValue(message(4, { kind: 'collage' as never }));
    const { result } = await openThread();

    let card: Message | null = null;
    await act(async () => {
      card = await result.current.startCollage('Trip', 'k1');
    });

    expect(api.startCollage).toHaveBeenCalledWith('c1', { clientId: 'k1', title: 'Trip' });
    expect(card).toMatchObject({ id: 'm4' });
    expect(result.current.messages.some((m) => m.id === 'm4')).toBe(true);
  });

  it('shows a message’s new place in the albums', async () => {
    api.removeFromAlbum.mockResolvedValue(message(2, { body: 'out of album' }));
    api.placeInAlbum.mockResolvedValue(message(2, { body: 'in album' }));
    const { result } = await openThread();

    await act(() => result.current.removeFromAlbum('m2', ['f1']));
    expect(api.removeFromAlbum).toHaveBeenCalledWith('c1', 'm2', ['f1']);
    expect(result.current.messages.find((m) => m.id === 'm2')?.body).toBe('out of album');

    await act(() => result.current.placeInAlbum('m2', { albumId: 'a2' } as never, ['f1']));
    expect(api.placeInAlbum).toHaveBeenCalledWith('c1', 'm2', { albumId: 'a2' }, ['f1']);
    expect(result.current.messages.find((m) => m.id === 'm2')?.body).toBe('in album');
  });
});

describe('typing and reading', () => {
  it('tells the others at most once in a stretch of typing', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const { result } = await openThread();

    act(() => result.current.notifyTyping());
    act(() => result.current.notifyTyping());
    expect(api.sendTyping).toHaveBeenCalledTimes(1);

    vi.spyOn(Date, 'now').mockReturnValue(1_000_000 + 3000);
    act(() => result.current.notifyTyping());
    expect(api.sendTyping).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });

  it('marks the newest message read, and again when the page comes back on screen', async () => {
    await openThread();
    await waitFor(() => expect(api.markRead).toHaveBeenCalledWith('c1', 'm2'));
    api.markRead.mockClear();

    const visibility = vi.spyOn(document, 'visibilityState', 'get');
    visibility.mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(api.markRead).not.toHaveBeenCalled();

    visibility.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(api.markRead).toHaveBeenCalledWith('c1', 'm2');
    visibility.mockRestore();
  });

  it('does not mind a read receipt that fails to send', async () => {
    api.markRead.mockRejectedValue(new Error('offline'));

    const { result } = await openThread();

    await waitFor(() => expect(api.markRead).toHaveBeenCalled());
    expect(result.current.error).toBeNull();
  });

  it('takes this conversation’s notification down once it is read here', async () => {
    const close = vi.fn();
    const getNotifications = vi.fn().mockResolvedValue([{ close }]);
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration: vi.fn().mockResolvedValue({ getNotifications }) }
    });

    await openThread();

    await waitFor(() => expect(close).toHaveBeenCalled());
    expect(getNotifications).toHaveBeenCalledWith({ tag: 'c1' });
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });
});
