import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { handleThreadEvent, type ThreadEventContext } from './threadEvents';
import type { ChatEvent } from '../types';

const ctx = (): ThreadEventContext => ({
  conversationId: 'c1',
  currentUserId: 'me',
  dispatch: vi.fn(),
  setReads: vi.fn(),
  setPresence: vi.fn(),
  setMembers: vi.fn(),
  setPhotoAlbum: vi.fn(),
  setAppearance: vi.fn(),
  setLiveShare: vi.fn(),
  noteTyping: vi.fn(),
  clearTyping: vi.fn(),
  refreshAssistants: vi.fn()
});

const event = (type: string, payload: unknown, conversationId: string | undefined = 'c1'): ChatEvent =>
  ({ type, conversationId, at: Date.parse('2026-10-28T10:00:00Z'), payload }) as ChatEvent;

/** What a state updater function would produce from `previous`. */
const apply = <T>(setter: unknown, previous: T): T =>
  ((setter as ReturnType<typeof vi.fn>).mock.calls[0][0] as (value: T) => T)(previous);

let c: ThreadEventContext;
beforeEach(() => {
  c = ctx();
});

describe('events from elsewhere', () => {
  it('ignores an event for another conversation', () => {
    handleThreadEvent(event('message.deleted', { id: 'm1' }, 'other'), c);
    expect(c.dispatch).not.toHaveBeenCalled();
  });

  it('ignores a thread event when no conversation is open', () => {
    c.conversationId = undefined;
    handleThreadEvent(event('message.deleted', { id: 'm1' }), c);
    expect(c.dispatch).not.toHaveBeenCalled();
  });

  it('takes presence whatever conversation is open, but not your own', () => {
    c.conversationId = undefined;
    handleThreadEvent(event('presence', { userId: 'her', online: true }, undefined), c);
    expect(apply(c.setPresence, {})).toEqual({ her: { userId: 'her', online: true } });

    const own = ctx();
    handleThreadEvent(event('presence', { userId: 'me' }, undefined), own);
    expect(own.setPresence).not.toHaveBeenCalled();
  });
});

describe('messages', () => {
  const message = { id: 'm2', senderId: 'her', createdAt: '2026-10-28T09:59:00Z' };

  it('adds a new message, ends the sender’s typing, and counts them as having read up to it', () => {
    handleThreadEvent(event('message.created', message), c);

    expect(c.dispatch).toHaveBeenCalledWith({ type: 'received', message });
    expect(c.clearTyping).toHaveBeenCalledWith('c1', 'her');
    expect(apply(c.setReads, {})).toEqual({
      her: { userId: 'her', lastReadMessageId: 'm2', lastReadAt: '2026-10-28T09:59:00Z' }
    });
  });

  it('does not mark you as having read your own message from another device', () => {
    handleThreadEvent(event('message.created', { ...message, senderId: 'me' }), c);
    expect(c.setReads).not.toHaveBeenCalled();
  });

  it.each(['message.updated', 'reaction.updated'])('replaces the message on %s', (type) => {
    handleThreadEvent(event(type, message), c);
    expect(c.dispatch).toHaveBeenCalledWith({ type: 'updated', message });
  });

  it('removes a deleted message', () => {
    handleThreadEvent(event('message.deleted', { id: 'm2' }), c);
    expect(c.dispatch).toHaveBeenCalledWith({ type: 'removed', id: 'm2' });
  });
});

describe('conversation.updated', () => {
  it('takes a new photo album and appearance', () => {
    const photoAlbum = { mode: 'album', albumId: 'a1', albumName: 'Rome' };
    const appearance = { theme: 'night', backgroundFileId: null, backgroundUrl: null };
    handleThreadEvent(event('conversation.updated', { photoAlbum, appearance }), c);
    expect(c.setPhotoAlbum).toHaveBeenCalledWith(photoAlbum);
    expect(c.setAppearance).toHaveBeenCalledWith(appearance);
  });

  it('renames one member and leaves the others', () => {
    handleThreadEvent(event('conversation.updated', { member: { userId: 'her', name: 'Irja', picture: null } }), c);

    const members = [
      { userId: 'me', name: 'Tom', picture: 'a.jpg' },
      { userId: 'her', name: 'Old', picture: 'b.jpg' }
    ];
    expect(apply(c.setMembers, members)).toEqual([
      { userId: 'me', name: 'Tom', picture: 'a.jpg' },
      { userId: 'her', name: 'Irja', picture: null }
    ]);
  });

  it('copes with an empty payload', () => {
    expect(() => handleThreadEvent(event('conversation.updated', null), c)).not.toThrow();
  });
});

describe('live sharing, typing and reading', () => {
  it('sets and drops a live share', () => {
    const share = { userId: 'her' };
    handleThreadEvent(event('live.updated', share), c);
    expect(c.setLiveShare).toHaveBeenCalledWith('her', share);

    handleThreadEvent(event('live.ended', { userId: 'her' }), c);
    expect(c.setLiveShare).toHaveBeenLastCalledWith('her', null);
  });

  it('notes an assistant at work, with what it is doing, apart from a person typing', () => {
    handleThreadEvent(event('typing', { userId: 'bot:b1', name: 'Tumbi', bot: true, activity: 'making a collage' }), c);
    expect(c.noteTyping).toHaveBeenCalledWith('c1', 'bot:b1', 'Tumbi', { bot: true, activity: 'making a collage' });
  });

  it('reloads the assistants when something about them changed, and not for other updates', () => {
    handleThreadEvent(event('conversation.updated', { assistants: true }), c);
    expect(c.refreshAssistants).toHaveBeenCalledTimes(1);
    handleThreadEvent(event('conversation.updated', { appearance: { theme: 'ocean' } }), c);
    handleThreadEvent(event('conversation.updated', null), c);
    expect(c.refreshAssistants).toHaveBeenCalledTimes(1);
  });

  it('notes someone else typing, never yourself', () => {
    handleThreadEvent(event('typing', { userId: 'her', name: 'Irja' }), c);
    expect(c.noteTyping).toHaveBeenCalledWith('c1', 'her', 'Irja');

    const own = ctx();
    handleThreadEvent(event('typing', { userId: 'me', name: 'Tom' }), own);
    expect(own.noteTyping).not.toHaveBeenCalled();
  });

  it('records how far someone has read, falling back to when the event happened', () => {
    handleThreadEvent(event('read', { userId: 'her', lastReadMessageId: 'm5' }), c);
    expect(apply(c.setReads, {})).toEqual({
      her: { userId: 'her', lastReadMessageId: 'm5', lastReadAt: '2026-10-28T10:00:00.000Z' }
    });
  });

  it('ignores your own read receipt', () => {
    handleThreadEvent(event('read', { userId: 'me', lastReadMessageId: 'm5' }), c);
    expect(c.setReads).not.toHaveBeenCalled();
  });
});
