import { describe, expect, it } from 'vitest';
import { initialThreadState, lastStoredMessage, threadReducer, type ThreadState } from './threadReducer';
import type { Message, ThreadMessage } from '../types';

const message = (overrides: Partial<Message> = {}): Message => ({
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

const stateWith = (messages: ThreadMessage[]): ThreadState => ({ ...initialThreadState, messages, loading: false });

describe('loading a page', () => {
  it.each(['pending', 'failed'] as const)('reconciles a %s send when a refetch proves it was delivered', (delivery) => {
    const state = threadReducer(stateWith([{ ...message({ id: 'pending-1' }), delivery }]), {
      type: 'loaded',
      messages: [message()],
      nextCursor: null
    });

    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]!.id).toBe('m1');
    expect(lastStoredMessage(state.messages)?.id).toBe('m1');
  });

  it('reverses the API order so the thread renders oldest first', () => {
    const state = threadReducer(initialThreadState, {
      type: 'loaded',
      // The API returns newest first.
      messages: [message({ id: 'm2', clientId: 'c2', createdAt: '2026-09-21T10:01:00.000Z' }), message()],
      nextCursor: null
    });

    expect(state.messages.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(state.loading).toBe(false);
  });

  it('keeps a pending message across a refetch', () => {
    // A reconnect refetches, and must not throw away what the user typed
    // while the connection was down.
    const pending: ThreadMessage = {
      ...message({ id: 'pending-x', clientId: 'client-x' }),
      delivery: 'pending'
    };

    const state = threadReducer(stateWith([pending]), {
      type: 'loaded',
      messages: [message()],
      nextCursor: null
    });

    expect(state.messages.map((m) => m.clientId)).toContain('client-x');
  });

  it('keeps a failed message across a refetch', () => {
    const failed: ThreadMessage = { ...message({ id: 'pending-y', clientId: 'client-y' }), delivery: 'failed' };

    const state = threadReducer(stateWith([failed]), { type: 'loaded', messages: [], nextCursor: null });

    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]!.delivery).toBe('failed');
  });

  it('records the cursor for the next older page', () => {
    const state = threadReducer(initialThreadState, {
      type: 'loaded',
      messages: [message()],
      nextCursor: '2026-09-21T09:00:00.000Z'
    });

    expect(state.nextCursor).toBe('2026-09-21T09:00:00.000Z');
  });
});

describe('older pages', () => {
  it('prepends them in render order', () => {
    const state = threadReducer(stateWith([message({ id: 'm3', clientId: 'c3', createdAt: '2026-09-21T12:00:00.000Z' })]), {
      type: 'olderLoaded',
      messages: [
        message({ id: 'm2', clientId: 'c2', createdAt: '2026-09-21T11:00:00.000Z' }),
        message({ id: 'm1', clientId: 'c1', createdAt: '2026-09-21T10:00:00.000Z' })
      ],
      nextCursor: null
    });

    expect(state.messages.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
    expect(state.loadingOlder).toBe(false);
  });

  it('does not duplicate a message that is already loaded', () => {
    const state = threadReducer(stateWith([message()]), {
      type: 'olderLoaded',
      messages: [message()],
      nextCursor: null
    });

    expect(state.messages).toHaveLength(1);
  });
});

describe('optimistic send', () => {
  it('keeps a stream-confirmed message delivered when the POST response is lost', () => {
    const echoed = threadReducer(initialThreadState, { type: 'received', message: message() });
    const state = threadReducer(echoed, { type: 'sendFailed', clientId: 'client-1' });

    expect(state.messages[0]!.delivery).toBe('sent');
  });

  it('shows the message immediately as pending', () => {
    const state = threadReducer(initialThreadState, {
      type: 'optimistic',
      message: { ...message({ id: 'pending-1' }), delivery: 'pending' }
    });

    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]!.delivery).toBe('pending');
  });

  it('settles in place when the server confirms, rather than appearing twice', () => {
    const pending = threadReducer(initialThreadState, {
      type: 'optimistic',
      message: { ...message({ id: 'pending-1', clientId: 'client-1' }), delivery: 'pending' }
    });

    const confirmed = threadReducer(pending, {
      type: 'confirmed',
      clientId: 'client-1',
      message: message({ id: 'real-1', clientId: 'client-1' })
    });

    expect(confirmed.messages).toHaveLength(1);
    expect(confirmed.messages[0]!.id).toBe('real-1');
    expect(confirmed.messages[0]!.delivery).toBe('sent');
  });

  it('does not duplicate when the stream echo arrives before the POST response', () => {
    // The stream can beat the HTTP response. Both carry the same clientId,
    // which is the only thing that can prove they are one message.
    const pending = threadReducer(initialThreadState, {
      type: 'optimistic',
      message: { ...message({ id: 'pending-1', clientId: 'client-1' }), delivery: 'pending' }
    });

    const echoed = threadReducer(pending, {
      type: 'received',
      message: message({ id: 'real-1', clientId: 'client-1' })
    });
    const confirmed = threadReducer(echoed, {
      type: 'confirmed',
      clientId: 'client-1',
      message: message({ id: 'real-1', clientId: 'client-1' })
    });

    expect(confirmed.messages).toHaveLength(1);
    expect(confirmed.messages[0]!.id).toBe('real-1');
  });

  it('marks a failed send so it can be retried', () => {
    const pending = threadReducer(initialThreadState, {
      type: 'optimistic',
      message: { ...message({ clientId: 'client-1' }), delivery: 'pending' }
    });

    const failed = threadReducer(pending, { type: 'sendFailed', clientId: 'client-1' });

    expect(failed.messages[0]!.delivery).toBe('failed');
  });
});

describe('incoming events', () => {
  it('appends a message from the other person', () => {
    const state = threadReducer(stateWith([message()]), {
      type: 'received',
      message: message({ id: 'm2', clientId: 'c2', senderId: 'u-irja', createdAt: '2026-09-21T10:05:00.000Z' })
    });

    expect(state.messages.map((m) => m.id)).toEqual(['m1', 'm2']);
  });

  it('sorts a replayed message back into place rather than appending it', () => {
    // After a reconnect the server replays what was missed, which can arrive
    // after messages that happened later.
    const state = threadReducer(stateWith([message({ id: 'm3', clientId: 'c3', createdAt: '2026-09-21T12:00:00.000Z' })]), {
      type: 'received',
      message: message({ id: 'm2', clientId: 'c2', createdAt: '2026-09-21T11:00:00.000Z' })
    });

    expect(state.messages.map((m) => m.id)).toEqual(['m2', 'm3']);
  });

  it('applies an edit to a loaded message', () => {
    const state = threadReducer(stateWith([message()]), {
      type: 'updated',
      message: message({ body: 'edited', editedAt: '2026-09-21T10:02:00.000Z' })
    });

    expect(state.messages[0]!.body).toBe('edited');
    expect(state.messages[0]!.editedAt).toBeTruthy();
  });

  it('ignores an edit for a message this client has not loaded', () => {
    // Inserting it would drop a message into the middle of a thread whose
    // surrounding pages are missing.
    const state = threadReducer(stateWith([message()]), {
      type: 'updated',
      message: message({ id: 'unknown', clientId: 'unknown' })
    });

    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]!.id).toBe('m1');
  });

  it('blanks a deleted message but keeps its place', () => {
    const state = threadReducer(stateWith([message()]), { type: 'removed', id: 'm1' });

    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]!.body).toBe('');
    expect(state.messages[0]!.deletedAt).toBeTruthy();
  });

  it('applies a reaction through the update path', () => {
    const state = threadReducer(stateWith([message()]), {
      type: 'updated',
      message: message({ reactions: [{ userId: 'u-irja', name: 'Irja', emoji: '❤️', at: '2026-09-21T10:03:00.000Z' }] })
    });

    expect(state.messages[0]!.reactions).toHaveLength(1);
  });
});

describe('failure', () => {
  it('clears both loading flags so the UI cannot hang on a spinner', () => {
    const state = threadReducer({ ...initialThreadState, loadingOlder: true }, { type: 'failed', error: 'offline' });

    expect(state.loading).toBe(false);
    expect(state.loadingOlder).toBe(false);
    expect(state.error).toBe('offline');
  });
});

describe('lastStoredMessage', () => {
  it('is the newest message the server has acknowledged', () => {
    const messages: ThreadMessage[] = [
      { ...message({ id: 'm1', clientId: 'c1' }), delivery: 'sent' },
      { ...message({ id: 'pending', clientId: 'c2' }), delivery: 'pending' }
    ];

    // The read cursor must never point at a message the server has not stored.
    expect(lastStoredMessage(messages)?.id).toBe('m1');
  });

  it('is undefined when everything is still in flight', () => {
    expect(lastStoredMessage([{ ...message(), delivery: 'pending' }])).toBeUndefined();
  });

  it('is undefined for an empty thread', () => {
    expect(lastStoredMessage([])).toBeUndefined();
  });
});
