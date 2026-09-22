import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Fab from '@mui/material/Fab';
import Typography from '@mui/material/Typography';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { ink } from '@tumbaland/frontend-core';
import type { ThreadMessage } from '../../types';
import { DaySeparator } from './DaySeparator';
import { MessageBubble } from './MessageBubble';

export interface MessageListProps {
  messages: ThreadMessage[];
  currentUserId: string;
  hasOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  onReact: (messageId: string, emoji: string) => void;
  onRetry: (clientId: string) => void;
  onPickEmoji: (messageId: string, anchor: HTMLElement) => void;
  onOpenMedia: (message: ThreadMessage, index: number) => void;
}

/** How close to the bottom still counts as "following the conversation". */
const NEAR_BOTTOM_PX = 120;

const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();

/** Consecutive messages from one person within two minutes are grouped. */
const GROUP_WINDOW_MS = 2 * 60 * 1000;

export function MessageList({
  messages,
  currentUserId,
  hasOlder,
  loadingOlder,
  onLoadOlder,
  onReact,
  onRetry,
  onPickEmoji,
  onOpenMedia
}: MessageListProps) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const bottom = useRef<HTMLDivElement | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  /** `atBottom` for the resize observer, which outlives any one render. */
  const atBottomRef = useRef(true);

  /**
   * Height before an older page is prepended.
   *
   * Prepending content pushes everything down by exactly the height added, so
   * without restoring the offset the thread jumps away from whatever the
   * reader was looking at. Recorded before the render, restored after it.
   */
  const anchor = useRef<{ height: number; top: number } | null>(null);
  const previousCount = useRef(messages.length);
  const previousFirstId = useRef(messages[0]?.id);

  const onScroll = useCallback(() => {
    const element = scroller.current;
    if (!element) return;

    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    atBottomRef.current = distance < NEAR_BOTTOM_PX;
    setAtBottom(atBottomRef.current);

    // Fetching starts before the reader reaches the very top, so the next page
    // is usually already there by the time they would have seen a gap.
    if (element.scrollTop < 200 && hasOlder && !loadingOlder) {
      anchor.current = { height: element.scrollHeight, top: element.scrollTop };
      onLoadOlder();
    }
  }, [hasOlder, loadingOlder, onLoadOlder]);

  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;

    const grewAtTop = messages[0]?.id !== previousFirstId.current;
    previousFirstId.current = messages[0]?.id;

    if (grewAtTop && anchor.current) {
      // Restore the reading position after a prepend.
      element.scrollTop = anchor.current.top + (element.scrollHeight - anchor.current.height);
      anchor.current = null;
      previousCount.current = messages.length;
      return;
    }

    const grewAtBottom = messages.length > previousCount.current;
    previousCount.current = messages.length;

    // Follow new messages only when the reader is already at the bottom.
    // Scrolling someone away from what they were reading because the other
    // person sent something is the single most irritating thing a chat can do.
    if (grewAtBottom && atBottom) {
      bottom.current?.scrollIntoView({ block: 'end' });
    }
  }, [messages, atBottom]);

  // The first render lands at the bottom without animating there.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, []);

  // The keyboard opening shrinks the list from below. Someone reading the
  // latest message is still reading it with the keyboard up, so the list stays
  // pinned to the bottom rather than leaving the newest lines under the composer.
  useEffect(() => {
    const element = scroller.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    let lastHeight = element.clientHeight;
    const observer = new ResizeObserver(() => {
      const shrank = element.clientHeight < lastHeight;
      lastHeight = element.clientHeight;
      if (shrank && atBottomRef.current) element.scrollTop = element.scrollHeight;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const unread = !atBottom;

  return (
    <Box sx={{ position: 'relative', flex: 1, minHeight: 0 }}>
      <Box
        ref={scroller}
        onScroll={onScroll}
        role="log"
        aria-label="Messages"
        aria-live="polite"
        sx={{
          height: '100%',
          overflowY: 'auto',
          px: { xs: 1, sm: 2 },
          py: 1,
          // Keeps the browser from fighting the anchoring above.
          overflowAnchor: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {hasOlder && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
            {loadingOlder ? (
              <CircularProgress size={18} />
            ) : (
              <Button size="small" onClick={onLoadOlder} sx={{ color: ink.muted }}>
                Load earlier messages
              </Button>
            )}
          </Box>
        )}

        {messages.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="body2" sx={{ color: ink.muted }}>
              No messages yet. Say something.
            </Typography>
          </Box>
        )}

        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const newDay = !previous || !sameDay(previous.createdAt, message.createdAt);
          const showSender =
            newDay ||
            !previous ||
            previous.senderId !== message.senderId ||
            new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() > GROUP_WINDOW_MS;

          return (
            <Box key={message.clientId || message.id}>
              {newDay && <DaySeparator iso={message.createdAt} />}
              <MessageBubble
                message={message}
                mine={message.senderId === currentUserId}
                showSender={showSender}
                onReact={onReact}
                onRetry={onRetry}
                onPickEmoji={onPickEmoji}
                onOpenMedia={onOpenMedia}
              />
            </Box>
          );
        })}

        <div ref={bottom} />
      </Box>

      {unread && (
        <Fab
          size="small"
          aria-label="Jump to latest"
          onClick={() => bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })}
          sx={{ position: 'absolute', right: 16, bottom: 16, bgcolor: 'background.paper' }}
        >
          <KeyboardArrowDownIcon />
        </Fab>
      )}
    </Box>
  );
}
