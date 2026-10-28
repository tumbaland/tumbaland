import { useEffect } from 'react';
import { chatApi } from '../services/chatApi';

/**
 * Takes this conversation's message notification down on this device once it
 * has been read here. Message pushes are tagged with the conversation id.
 */
function closeNotifications(conversationId: string): void {
  if (!('serviceWorker' in navigator)) return;
  void navigator.serviceWorker
    .getRegistration()
    .then((registration) => registration?.getNotifications({ tag: conversationId }))
    .then((notifications) => notifications?.forEach((notification) => notification.close()))
    .catch(() => undefined);
}

/**
 * Reports the thread as read up to its newest stored message.
 *
 * Driven by that message rather than by a scroll position: the thread is only
 * rendered when it is on screen, and a scroll-based cursor misfires on a short
 * thread that never scrolls.
 *
 * Also runs when the page comes back on screen: a message that arrived while
 * it was hidden was not read then, and without this it stayed unread (and
 * kept its notification) until the next message moved the cursor.
 */
export function useMarkRead(conversationId: string | undefined, newestId: string | undefined): void {
  useEffect(() => {
    if (!conversationId || !newestId) return;

    const markRead = () => {
      if (document.visibilityState === 'hidden') return;
      void chatApi.markRead(conversationId, newestId).catch(() => {
        // A missed read receipt self-corrects on the next message.
      });
      closeNotifications(conversationId);
    };

    markRead();
    document.addEventListener('visibilitychange', markRead);
    return () => document.removeEventListener('visibilitychange', markRead);
  }, [conversationId, newestId]);
}
