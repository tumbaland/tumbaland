import { useCallback, useEffect, useMemo, useState, type MutableRefObject } from 'react';
import { chatApi } from '../services/chatApi';
import type { AssistantSettingsChange, AssistantsView, BotChange, BotInput } from '../types';

/**
 * The assistants in this conversation, for the dialog and for everything that
 * needs to know the bots: the `@` list, and how a bot's message is drawn.
 *
 * Asked for when the thread opens, and again whenever the stream says something
 * changed, someone else's edit or a reply having used up some allowance.
 * Changes made here come back with the new view, so the dialog needs no second
 * request. `conversationRef` is the conversation on screen, so an answer that
 * arrives after switching threads is thrown away.
 */
export function useThreadAssistants(
  conversationId: string | undefined,
  conversationRef: MutableRefObject<string | undefined>
) {
  const [assistants, setAssistants] = useState<AssistantsView | null>(null);

  const refreshAssistants = useCallback(() => {
    if (!conversationId) return;
    void chatApi
      .getAssistants(conversationId)
      .then((view) => {
        if (conversationRef.current === conversationId) setAssistants(view);
      })
      // The thread is fine without it: no `@` suggestions and plain bubbles until the next try.
      .catch(() => undefined);
  }, [conversationId, conversationRef]);

  // Another thread's bots must not show while this one loads.
  useEffect(() => {
    setAssistants(null);
  }, [conversationId]);

  const adopt = useCallback(
    (view: AssistantsView): AssistantsView => {
      if (conversationRef.current === conversationId) setAssistants(view);
      return view;
    },
    [conversationId, conversationRef]
  );

  /** Each throws what the server said, for the dialog to show; none of them swallow it. */
  const actions = useMemo(
    () => ({
      change: (change: AssistantSettingsChange) => chatApi.changeAssistants(conversationId!, change).then(adopt),
      createBot: (input: BotInput) => chatApi.createBot(conversationId!, input).then(adopt),
      updateBot: (botId: string, change: BotChange) => chatApi.updateBot(conversationId!, botId, change).then(adopt),
      deleteBot: (botId: string) => chatApi.deleteBot(conversationId!, botId).then(adopt),
      /** A lower cap of one's own on the allowance; the view is asked for again, as it carries the allowance. */
      setCap: async (capPercent: number | null) => {
        await chatApi.setAllowanceCap(capPercent);
        refreshAssistants();
      }
    }),
    [conversationId, adopt, refreshAssistants]
  );

  return { assistants, refreshAssistants, assistantActions: actions };
}
