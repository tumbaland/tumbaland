import { useState } from 'react';
import type { UseChatThreadResult } from './useChatThread';
import type { SearchDialogProps } from '../components/thread/SearchDialog';

/** Search and quoted replies use the same load-and-scroll operation. */
export function useThreadSearch(
  conversationId: string | undefined,
  currentUserId: string,
  thread: Pick<UseChatThreadResult, 'members' | 'loadUntil'>,
  onError: (message: string) => void
) {
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState<{ id: string; key: number } | null>(null);
  const [jumping, setJumping] = useState(false);
  const jumpTo = async (messageId: string, createdAt: string) => {
    setJumping(true);
    try {
      const outcome = await thread.loadUntil(messageId, createdAt);
      if (outcome === 'found') setFocus({ id: messageId, key: Date.now() });
      else if (outcome === 'too-far') onError('That message is too far back to open here.');
      else onError('That message is no longer in the chat.');
    } catch {
      onError('Could not open that message. Try again.');
    } finally {
      setJumping(false);
    }
  };
  const dialog: SearchDialogProps = {
    open,
    onClose: () => setOpen(false),
    conversationId: conversationId ?? '',
    members: thread.members,
    currentUserId,
    onPick: (message) => {
      setOpen(false);
      void jumpTo(message.id, message.createdAt);
    }
  };
  return { open: () => setOpen(true), focus, jumping, jumpTo, dialog };
}
