import { useCallback, type Dispatch, type MutableRefObject } from 'react';
import { chatApi } from '../services/chatApi';
import type { ThreadAction, ThreadState } from './threadReducer';
import type { MessagePage } from '../types';

/**
 * How far back opening a search result will load: 30 pages of 100. Every
 * message loaded is a bubble on the page, and a result from years back would
 * otherwise pull the whole history onto a phone to show one line.
 */
const JUMP_PAGE_SIZE = 100;
const JUMP_MAX_PAGES = 30;

/** Older messages: one page at a time, or as many as it takes to reach a given one. */
export function useThreadPaging(
  conversationId: string | undefined,
  state: ThreadState,
  /** The newest state, for `loadUntil`, whose loop outlives the render it started in. */
  latestState: MutableRefObject<ThreadState>,
  conversationRef: MutableRefObject<string | undefined>,
  dispatch: Dispatch<ThreadAction>
) {
  const loadOlder = useCallback(async () => {
    const cursor = state.nextCursor;
    if (!conversationId || !cursor || state.loadingOlder) return;

    dispatch({ type: 'loadingOlder' });
    try {
      const page = await chatApi.listMessages(conversationId, { before: cursor, limit: 50 });
      dispatch({ type: 'olderLoaded', messages: page.messages, nextCursor: page.nextCursor });
    } catch (error) {
      dispatch({ type: 'failed', error: (error as Error).message });
    }
  }, [conversationId, state.nextCursor, state.loadingOlder, dispatch]);

  const loadUntil = useCallback(
    async (messageId: string, createdAt: string): Promise<'found' | 'gone' | 'too-far'> => {
      if (!conversationId) return 'gone';
      if (latestState.current.messages.some((message) => message.id === messageId)) return 'found';

      const target = new Date(createdAt).getTime();
      let cursor = latestState.current.nextCursor;
      for (let page = 0; cursor && page < JUMP_MAX_PAGES; page++) {
        if (conversationRef.current !== conversationId) return 'gone';
        dispatch({ type: 'loadingOlder' });
        let result: MessagePage;
        try {
          result = await chatApi.listMessages(conversationId, { before: cursor, limit: JUMP_PAGE_SIZE });
        } catch (error) {
          // Settles the spinner without an error banner over the thread; the
          // caller says what went wrong.
          dispatch({ type: 'olderLoaded', messages: [], nextCursor: cursor });
          throw error;
        }
        dispatch({ type: 'olderLoaded', messages: result.messages, nextCursor: result.nextCursor });
        if (result.messages.some((message) => message.id === messageId)) return 'found';

        // Walked past where it was without finding it: unsent since the search.
        const oldest = result.messages[result.messages.length - 1];
        if (oldest && new Date(oldest.createdAt).getTime() < target) return 'gone';
        cursor = result.nextCursor;
      }
      return cursor ? 'too-far' : 'gone';
    },
    [conversationId, latestState, conversationRef, dispatch]
  );

  return { loadOlder, loadUntil };
}
