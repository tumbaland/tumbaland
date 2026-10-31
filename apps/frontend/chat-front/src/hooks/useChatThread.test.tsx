import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ChatEvent, LiveShare, Message } from '../types';

const listMessages = vi.fn();
const getConversation = vi.fn();
const listLive = vi.fn();
const getAssistants = vi.fn();
let streamEvent: ((event: ChatEvent) => void) | undefined;

vi.mock('../services/chatApi', () => ({
  chatApi: {
    listMessages: (...args: unknown[]) => listMessages(...args),
    getConversation: (...args: unknown[]) => getConversation(...args),
    listLive: (...args: unknown[]) => listLive(...args),
    getAssistants: (...args: unknown[]) => getAssistants(...args),
    markRead: () => Promise.resolve()
  },
  newClientId: () => 'client-x'
}));
vi.mock('./useChatStream', () => ({
  useChatStream: ({ onEvent }: { onEvent: (event: ChatEvent) => void }) => {
    streamEvent = onEvent;
  }
}));

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
  getConversation.mockReset().mockReturnValue(new Promise(() => {}));
  listLive.mockReset().mockResolvedValue([]);
  getAssistants.mockReset().mockResolvedValue(null);
});

describe('opening a thread', () => {
  const detail = {
    id: 'c1',
    title: '',
    members: [],
    reads: [
      { userId: 'u-tom', lastReadMessageId: 'm2', lastReadAt: '2026-01-01T00:02:00Z' },
      { userId: 'u-irja', lastReadMessageId: 'm1', lastReadAt: '2026-01-01T00:01:00Z' }
    ]
  };

  it('loads once, not again when the signed-in user becomes known a moment later', async () => {
    listMessages.mockResolvedValue(page(2, 1, null));
    getConversation.mockReset().mockResolvedValue(detail);
    // The user id is empty on the first render and filled in after the check-in resolves
    const hook = renderHook(({ userId }) => useChatThread('c1', userId), { initialProps: { userId: '' } });
    await waitFor(() => expect(hook.result.current.loading).toBe(false));

    hook.rerender({ userId: 'u-tom' });
    await act(async () => undefined);

    expect(listMessages).toHaveBeenCalledTimes(1);
    expect(getConversation).toHaveBeenCalledTimes(1);
    expect(getAssistants).toHaveBeenCalledTimes(1);
    expect(listLive).toHaveBeenCalledTimes(1);
  });

  it('keeps the caller out of the read markers, whichever arrives first', async () => {
    listMessages.mockResolvedValue(page(2, 1, null));
    getConversation.mockReset().mockResolvedValue(detail);
    const hook = renderHook(({ userId }) => useChatThread('c1', userId), { initialProps: { userId: '' } });
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await waitFor(() => expect(Object.keys(hook.result.current.reads).length).toBeGreaterThan(0));

    hook.rerender({ userId: 'u-tom' });

    expect(Object.keys(hook.result.current.reads)).toEqual(['u-irja']);
  });

  it('asks for the assistants and the live shares only once the messages are in', async () => {
    let deliver: (value: ReturnType<typeof page>) => void = () => {};
    listMessages.mockReturnValue(new Promise((resolve) => (deliver = resolve)));
    getConversation.mockReset().mockResolvedValue(detail);
    const hook = renderHook(() => useChatThread('c1', 'u-tom'));
    await act(async () => undefined);

    // the messages are still on their way: nothing else competes with them
    expect(getAssistants).not.toHaveBeenCalled();
    expect(listLive).not.toHaveBeenCalled();

    await act(async () => deliver(page(2, 1, null)));
    await waitFor(() => expect(hook.result.current.loading).toBe(false));

    expect(getAssistants).toHaveBeenCalledTimes(1);
    expect(listLive).toHaveBeenCalledTimes(1);
  });

  it('still asks for them when the messages could not be loaded, so a retry is not half a thread', async () => {
    listMessages.mockRejectedValue(new Error('offline'));
    getConversation.mockReset().mockResolvedValue(detail);
    renderHook(() => useChatThread('c1', 'u-tom'));

    await waitFor(() => expect(getAssistants).toHaveBeenCalledTimes(1));
    expect(listLive).toHaveBeenCalledTimes(1);
  });

  it('still loads again for a different conversation', async () => {
    listMessages.mockResolvedValue(page(2, 1, null));
    getConversation.mockReset().mockResolvedValue(detail);
    const hook = renderHook(({ id }) => useChatThread(id, 'u-tom'), { initialProps: { id: 'c1' } });
    await waitFor(() => expect(hook.result.current.loading).toBe(false));

    hook.rerender({ id: 'c2' });
    await waitFor(() => expect(listMessages).toHaveBeenCalledTimes(2));
  });
});

describe('member renames', () => {
  it("shows someone's new name as soon as the stream says they changed it", async () => {
    listMessages.mockResolvedValueOnce(page(2, 1, null));
    getConversation.mockResolvedValueOnce({
      id: 'c1',
      title: '',
      members: [{ userId: 'u-irja', email: 'irja@test', name: 'Irja', joinedAt: '2026-01-01T00:00:00Z' }],
      reads: []
    });
    const { result } = await openThread();
    await waitFor(() => expect(result.current.members[0]?.name).toBe('Irja'));

    act(() =>
      streamEvent!({
        type: 'conversation.updated',
        conversationId: 'c1',
        at: Date.now(),
        payload: { member: { userId: 'u-irja', name: 'Irja Tamm', picture: null } }
      })
    );

    expect(result.current.members[0]).toMatchObject({ name: 'Irja Tamm', email: 'irja@test' });
  });
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
    listMessages
      .mockResolvedValueOnce(page(500, 451, 'cursor-451'))
      .mockResolvedValueOnce(page(450, 351, 'cursor-351'));
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

describe('sharing where one is, live', () => {
  const share = (overrides: Partial<LiveShare> = {}): LiveShare => ({
    userId: 'u-irja',
    name: 'Irja',
    position: { lat: 59.43, lng: 24.75, accuracy: 10, heading: null, speed: null, at: '2026-10-22T18:00:00.000Z' },
    startedAt: '2026-10-22T17:55:00.000Z',
    endsAt: '2099-01-01T00:00:00.000Z',
    destination: null,
    fixed: false,
    pinLabel: null,
    watchers: [],
    ...overrides
  });

  it('shows who is sharing when the thread opens', async () => {
    listMessages.mockResolvedValueOnce(page(2, 1, null));
    listLive.mockResolvedValueOnce([share()]);

    const { result } = await openThread();

    await waitFor(() => expect(result.current.live).toHaveLength(1));
  });

  it('moves a share along as the stream reports it, and drops it when it ends', async () => {
    listMessages.mockResolvedValueOnce(page(2, 1, null));
    const { result } = await openThread();

    act(() => streamEvent?.({ type: 'live.updated', conversationId: 'c1', at: 1, payload: share() }));
    act(() =>
      streamEvent?.({
        type: 'live.updated',
        conversationId: 'c1',
        at: 2,
        payload: share({ position: { ...share().position!, lat: 59.5 } })
      })
    );
    expect(result.current.live).toHaveLength(1);
    expect(result.current.live[0]!.position!.lat).toBe(59.5);

    act(() => streamEvent?.({ type: 'live.ended', conversationId: 'c1', at: 3, payload: { userId: 'u-irja' } }));
    expect(result.current.live).toEqual([]);
  });

  it('takes a share from an answer ahead of the stream, and can drop it', async () => {
    listMessages.mockResolvedValueOnce(page(2, 1, null));
    const { result } = await openThread();

    act(() => result.current.setLiveShare('u-tom', share({ userId: 'u-tom', name: 'Tom' })));
    expect(result.current.live.map((entry) => entry.userId)).toEqual(['u-tom']);

    act(() => result.current.setLiveShare('u-tom', null));
    expect(result.current.live).toEqual([]);
  });

  it('does not resurrect a stopped share from an older list request', async () => {
    listMessages.mockResolvedValueOnce(page(2, 1, null));
    let finish!: (shares: LiveShare[]) => void;
    listLive.mockReturnValueOnce(
      new Promise<LiveShare[]>((resolve) => {
        finish = resolve;
      })
    );
    const { result } = await openThread();
    act(() => streamEvent?.({ type: 'live.updated', conversationId: 'c1', at: 1, payload: share() }));
    act(() => streamEvent?.({ type: 'live.ended', conversationId: 'c1', at: 2, payload: { userId: 'u-irja' } }));
    await act(async () => {
      finish([share()]);
    });
    expect(result.current.live).toEqual([]);
  });

  it('removes expired shares so an open map also disappears', async () => {
    listMessages.mockResolvedValueOnce(page(2, 1, null));
    const { result } = await openThread();
    vi.useFakeTimers();
    try {
      act(() => result.current.setLiveShare('u-irja', share({ endsAt: new Date(Date.now() + 5000).toISOString() })));
      await act(async () => vi.advanceTimersByTime(5001));
      expect(result.current.live).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('assistants', () => {
  it('loads the assistants with the thread, and again whenever the stream says they changed', async () => {
    listMessages.mockResolvedValueOnce(page(2, 1, null));
    getAssistants.mockResolvedValue({ enabled: true, bots: [] });
    const { result } = await openThread();

    await waitFor(() => expect(result.current.assistants).toEqual({ enabled: true, bots: [] }));
    expect(getAssistants).toHaveBeenCalledTimes(1);

    getAssistants.mockResolvedValue({ enabled: false, bots: [] });
    act(() => streamEvent?.({ type: 'conversation.updated', conversationId: 'c1', at: 1, payload: { assistants: true } }));
    await waitFor(() => expect(result.current.assistants).toEqual({ enabled: false, bots: [] }));
    expect(getAssistants).toHaveBeenCalledTimes(2);
  });

  it('shows an assistant at work apart from people typing, and stops when its message arrives', async () => {
    listMessages.mockResolvedValueOnce(page(2, 1, null));
    const { result } = await openThread();

    act(() =>
      streamEvent?.({
        type: 'typing',
        conversationId: 'c1',
        at: 1,
        payload: { userId: 'bot:b1', name: 'Tumbi', bot: true, activity: 'making a collage' }
      })
    );
    expect(result.current.assistantsWorking).toEqual([{ name: 'Tumbi', activity: 'making a collage' }]);
    expect(result.current.typingNames).toEqual([]);

    act(() => streamEvent?.({ type: 'message.created', conversationId: 'c1', at: 2, payload: { ...message(9), senderId: 'bot:b1', botId: 'b1' } }));
    expect(result.current.assistantsWorking).toEqual([]);
  });
});
