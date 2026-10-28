import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { chatApi } from '../services/chatApi';
import type { LiveShare } from '../types';

/** How often a thread with someone sharing live asks for their position, beside the stream. */
const LIVE_REFRESH_MS = 20_000;

/**
 * Who is sharing where they are, in this conversation: told by the stream,
 * asked for now and then, and dropped when a share runs out.
 *
 * `conversationRef` is the conversation on screen, so an answer that arrives
 * after switching threads is thrown away.
 */
export function useThreadLive(
  conversationId: string | undefined,
  conversationRef: MutableRefObject<string | undefined>
) {
  const [live, setLive] = useState<LiveShare[]>([]);
  const liveRevision = useRef(0);

  const setLiveShare = useCallback((userId: string, share: LiveShare | null) => {
    liveRevision.current += 1;
    setLive((current) => [...current.filter((entry) => entry.userId !== userId), ...(share ? [share] : [])]);
  }, []);

  const refreshLive = useCallback(() => {
    if (!conversationId) return;
    const revision = liveRevision.current;
    void chatApi
      .listLive(conversationId)
      .then((shares) => {
        // A snapshot requested before a stream event or a local stop must not undo it.
        if (conversationRef.current === conversationId && liveRevision.current === revision) {
          liveRevision.current += 1;
          setLive(shares);
        }
      })
      .catch(() => undefined);
  }, [conversationId, conversationRef]);

  // Another thread's shares must not show while this one loads.
  useEffect(() => {
    setLive([]);
    liveRevision.current += 1;
  }, [conversationId]);

  // While someone is sharing, asked again now and then as well as told by the
  // stream: a stream that fell back to polling carries no live events, and a
  // position that stops arriving should still be seen to age.
  const sharing = live.length > 0;
  useEffect(() => {
    if (!conversationId || !sharing) return;
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      refreshLive();
    }, LIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [conversationId, sharing, refreshLive]);

  // Expiry also closes an open viewer; the banner alone hiding it would leave its map up.
  useEffect(() => {
    if (!live.length) return;
    const nextEnd = Math.min(...live.map((share) => new Date(share.endsAt).getTime()));
    const timer = setTimeout(
      () => {
        liveRevision.current += 1;
        setLive((current) => current.filter((share) => new Date(share.endsAt).getTime() > Date.now()));
      },
      Math.min(2_147_483_647, Math.max(0, nextEnd - Date.now()))
    );
    return () => clearTimeout(timer);
  }, [live]);

  return { live, setLiveShare, refreshLive };
}
