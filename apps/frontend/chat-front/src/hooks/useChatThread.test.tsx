import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Message } from '../types';

const listMessages = vi.fn();

vi.mock('../services/chatApi', () => ({
  chatApi: {
    listMessages: (...args: unknown[]) => listMessages(...args),
    getConversation: () => new Promise(() => {}),
    markRead: () => Promise.resolve()
  },
  newClientId: () => 'client-x'
}));
vi.mock('./useChatStream', () => ({ useChatStream: () => {} }));

import { useChatThread } from './useChatThread';

/** Message `n` is `n` minutes after the start: a higher number is newer. */
const message = (n: number): Message => ({
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
  createdAt: new Date(Date.UTC(2026, 0, 1, 0, n)).toISOString()
});

/** Newest first, as the API pages them: `from` down to `to`. */
const page = (from: number, to: number, nextCursor: string | null) => ({
  messages: Array.from({ length: from - to + 1 }, (_, index) => message(from - index)),
  nextCursor
});

async function openThread() {
  const hook = renderHook(() => useChatThread('c1', 'u-tom'));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

beforeEach(() => {
  listMessages.mockReset();
});

describe('loadUntil', () => {
  it('answers straight away for a message already in the thread', async () => {
    listMessages.mockResolvedValueOnce(page(500, 451, 'cursor-451'));
    const { result } = await openThread();

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.loadUntil('m460', message(460).createdAt);
    });

    expect(outcome).toBe('found');
    expect(listMessages).toHaveBeenCalledTimes(1);
  });

  it('loads older pages until the message is there', async () => {
    listMessages
      .mockResolvedValueOnce(page(500, 451, 'cursor-451'))
      .mockResolvedValueOnce(page(450, 351, 'cursor-351'))
      .mockResolvedValueOnce(page(350, 251, 'cursor-251'));
    const { result } = await openThread();

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.loadUntil('m300', message(300).createdAt);
    });

    expect(outcome).toBe('found');
    expect(listMessages).toHaveBeenLastCalledWith('c1', { before: 'cursor-351', limit: 100 });
    expect(result.current.messages.some((loaded) => loaded.id === 'm300')).toBe(true);
    expect(result.current.loadingOlder).toBe(false);
  });

  it('says the message is gone when the pages walk past where it was', async () => {
    listMessages.mockResolvedValueOnce(page(500, 451, 'cursor-451')).mockResolvedValueOnce(page(450, 351, 'cursor-351'));
    const { result } = await openThread();

    let outcome: string | undefined;
    await act(async () => {
      // Between two loaded messages, but not among them: unsent since.
      outcome = await result.current.loadUntil('m-unsent', new Date(Date.UTC(2026, 0, 1, 0, 400, 30)).toISOString());
    });

    expect(outcome).toBe('gone');
  });

  it('stops at the limit rather than loading the whole history', async () => {
    listMessages.mockResolvedValueOnce(page(5000, 4951, 'cursor'));
    listMessages.mockImplementation(async () => page(4900, 4801, 'cursor'));
    const { result } = await openThread();

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.loadUntil('m1', message(1).createdAt);
    });

    expect(outcome).toBe('too-far');
    // The first page, then thirty more.
    expect(listMessages).toHaveBeenCalledTimes(31);
  });

  it('settles the spinner and passes the error on when a page fails', async () => {
    listMessages.mockResolvedValueOnce(page(500, 451, 'cursor-451')).mockRejectedValueOnce(new Error('offline'));
    const { result } = await openThread();

    await act(async () => {
      await expect(result.current.loadUntil('m300', message(300).createdAt)).rejects.toThrow('offline');
    });

    expect(result.current.loadingOlder).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.hasOlder).toBe(true);
  });
});
