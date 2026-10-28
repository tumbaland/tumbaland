import { describe, expect, it } from 'vite-plus/test';
import { albumLabel, canChange, isJumbo } from './messageBubbleUtils';
import type { ThreadMessage } from '../../types';

const message = (overrides: Partial<ThreadMessage> = {}): ThreadMessage => ({
  id: 'm1',
  conversationId: 'c1',
  senderId: 'u-tom',
  senderEmail: 'tom@example.com',
  senderName: 'Tom',
  kind: 'text',
  body: 'hello',
  attachments: [],
  replyTo: null,
  reactions: [],
  clientId: 'client-1',
  editedAt: null,
  deletedAt: null,
  createdAt: '2026-09-21T10:00:00.000Z',
  ...overrides
});

describe('isJumbo', () => {
  it.each([['❤️'], ['👍'], ['😂😂'], ['🎉🎉🎉']])('treats a short emoji-only message as jumbo (%s)', (body) => {
    expect(isJumbo(body)).toBe(true);
  });

  it('treats a skin-toned emoji as one emoji, not three', () => {
    expect(isJumbo('👍🏽')).toBe(true);
  });

  it.each([['hello'], ['❤️ you'], ['😂😂😂😂'], ['']])('is not jumbo for %s', (body) => {
    expect(isJumbo(body)).toBe(false);
  });
});

describe('canChange', () => {
  const base = message();

  it('lets the sender change a stored message', () => {
    expect(canChange(base, true)).toBe(true);
  });

  it.each([
    ['someone else’s', base, false],
    ['a pending', { ...base, delivery: 'pending' as const }, true],
    ['a failed', { ...base, delivery: 'failed' as const }, true],
    ['an unsent', { ...base, deletedAt: '2026-09-21T10:05:00.000Z' }, true],
    ['a system', { ...base, kind: 'system' as const }, true]
  ])('refuses %s message', (_label, target, mine) => {
    expect(canChange(target, mine)).toBe(false);
  });
});

describe('albumLabel', () => {
  const photo = (fileId: string, albumId: string | null, albumName: string | null = albumId) => ({
    fileId,
    mimetype: 'image/jpeg',
    sizeBytes: 1,
    albumId,
    albumName
  });

  it('names the album when every photo is in it', () => {
    expect(albumLabel([photo('a', 'Rome'), photo('b', 'Rome')])).toBe('In Rome');
  });

  it('says how many are in it when some were left out', () => {
    expect(albumLabel([photo('a', 'Rome'), photo('b', null), photo('c', 'Rome')])).toBe('2 of 3 in Rome');
  });

  it('counts the albums when the photos went different ways', () => {
    expect(albumLabel([photo('a', 'Rome'), photo('b', 'Home')])).toBe('In 2 albums');
  });

  it('leaves a document out of the count', () => {
    expect(albumLabel([photo('a', 'Rome'), { fileId: 'd', mimetype: 'application/pdf', sizeBytes: 1 }])).toBe('In Rome');
  });
});
