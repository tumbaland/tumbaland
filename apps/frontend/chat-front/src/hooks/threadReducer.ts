import type { Message, ThreadMessage } from '../types';

/**
 * The thread's state, as a reducer rather than a query cache.
 *
 * A thread is an append-only log with three writers racing each other: the
 * page the user is scrolling, the optimistic copy of what they just typed, and
 * the stream echoing back what the server stored. Reconciling those is the
 * whole problem, and it is clearer as explicit transitions than as cache
 * invalidation.
 *
 * Messages are held oldest-first, which is render order. The API returns
 * newest-first, so every page is reversed on the way in.
 */

export interface ThreadState {
  messages: ThreadMessage[];
  /** Cursor for the next older page; null once the thread's start is loaded. */
  nextCursor: string | null;
  loading: boolean;
  loadingOlder: boolean;
  error: string | null;
}

export const initialThreadState: ThreadState = {
  messages: [],
  nextCursor: null,
  loading: true,
  loadingOlder: false,
  error: null
};

export type ThreadAction =
  | { type: 'loading' }
  | { type: 'loaded'; messages: Message[]; nextCursor: string | null }
  | { type: 'loadingOlder' }
  | { type: 'olderLoaded'; messages: Message[]; nextCursor: string | null }
  | { type: 'failed'; error: string }
  | { type: 'optimistic'; message: ThreadMessage }
  | { type: 'confirmed'; clientId: string; message: Message }
  | { type: 'sendFailed'; clientId: string }
  | { type: 'received'; message: Message }
  | { type: 'updated'; message: Message }
  | { type: 'removed'; id: string };

const byTime = (a: ThreadMessage, b: ThreadMessage) =>
  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

/**
 * Inserts or replaces a message.
 *
 * Matched on `clientId` first, then `id`. The `clientId` match is what makes
 * the sender's own message settle in place rather than appear twice: the
 * optimistic copy and the stream echo are the same message, and only the
 * client key they share can prove it.
 */
function upsert(messages: ThreadMessage[], incoming: ThreadMessage): ThreadMessage[] {
  const index = messages.findIndex(
    (message) =>
      (incoming.clientId && message.clientId === incoming.clientId) ||
      (incoming.id && message.id === incoming.id)
  );

  if (index === -1) {
    // Appended and sorted rather than pushed: a message can arrive out of
    // order after a reconnect replay.
    return [...messages, incoming].sort(byTime);
  }

  const next = [...messages];
  next[index] = { ...next[index], ...incoming };
  return next;
}

export function threadReducer(state: ThreadState, action: ThreadAction): ThreadState {
  switch (action.type) {
    case 'loading':
      return { ...state, loading: true, error: null };

    case 'loaded': {
      // Anything still pending is kept: a refetch triggered by a reconnect
      // must not drop a message the user typed while offline.
      const pending = state.messages.filter((message) => message.delivery === 'pending' || message.delivery === 'failed');
      const loaded = [...action.messages].reverse() as ThreadMessage[];
      const merged = pending.reduce((acc, message) => upsert(acc, message), loaded);

      return { ...state, messages: merged, nextCursor: action.nextCursor, loading: false, error: null };
    }

    case 'loadingOlder':
      return { ...state, loadingOlder: true };

    case 'olderLoaded': {
      const older = [...action.messages].reverse() as ThreadMessage[];
      const merged = older.reduce((acc, message) => upsert(acc, message), state.messages);
      return { ...state, messages: merged, nextCursor: action.nextCursor, loadingOlder: false };
    }

    case 'failed':
      return { ...state, loading: false, loadingOlder: false, error: action.error };

    case 'optimistic':
      return { ...state, messages: upsert(state.messages, action.message) };

    case 'confirmed':
      return {
        ...state,
        messages: upsert(state.messages, { ...action.message, delivery: 'sent' })
      };

    case 'sendFailed':
      return {
        ...state,
        messages: state.messages.map((message) =>
          message.clientId === action.clientId ? { ...message, delivery: 'failed' as const } : message
        )
      };

    case 'received':
      // No delivery marker: it came from the server, so it is stored. If this
      // is the echo of our own send, `upsert` finds it by clientId and the
      // pending marker is cleared here.
      return { ...state, messages: upsert(state.messages, { ...action.message, delivery: 'sent' }) };

    case 'updated': {
      const index = state.messages.findIndex((message) => message.id === action.message.id);
      // An edit for a message this client has not loaded is dropped rather
      // than inserted: inserting it would put a message into the middle of a
      // thread whose surrounding pages are missing.
      if (index === -1) return state;
      const next = [...state.messages];
      next[index] = { ...next[index], ...action.message };
      return { ...state, messages: next };
    }

    case 'removed':
      return {
        ...state,
        messages: state.messages.map((message) =>
          message.id === action.id
            ? { ...message, deletedAt: new Date().toISOString(), body: '', attachments: [], reactions: [] }
            : message
        )
      };

    default:
      return state;
  }
}

/** The newest message that came from the server, for the read cursor. */
export function lastStoredMessage(messages: ThreadMessage[]): ThreadMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]!;
    if (message.delivery !== 'pending' && message.delivery !== 'failed') return message;
  }
  return undefined;
}
