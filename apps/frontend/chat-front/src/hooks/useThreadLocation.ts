import { useEffect, useState } from 'react';
import { useDriveShare } from './useDriveShare';
import type { UseChatThreadResult } from './useChatThread';
import type { LiveShare } from '../types';
import { preloadLiveMap } from '../components/live/loadLiveMap';

/** Live sharing stays with the thread while its map is hidden or reopened. */
export function useThreadLocation(
  conversationId: string | undefined,
  currentUserId: string,
  thread: Pick<UseChatThreadResult, 'live' | 'members' | 'setLiveShare'>
) {
  const { setLiveShare } = thread;
  const drive = useDriveShare(conversationId, (share) => setLiveShare(currentUserId, share));
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  useEffect(() => {
    setOpen(false);
    setViewing(null);
  }, [conversationId]);

  const audience =
    thread.members
      .filter((member) => member.userId !== currentUserId)
      .map((member) => member.name || member.email)
      .join(', ') || 'The others';

  return {
    drive,
    open,
    openMap: () => {
      preloadLiveMap();
      setOpen(true);
    },
    closeMap: () => setOpen(false),
    ownShare: thread.live.find((share) => share.userId === currentUserId) ?? null,
    watchedShare: thread.live.find((share) => share.userId === viewing) ?? null,
    watch: setViewing,
    closeViewer: () => setViewing(null),
    audience,
    updateShare: (share: LiveShare) => setLiveShare(share.userId, share)
  };
}
