import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Fab from '@mui/material/Fab';
import Typography from '@mui/material/Typography';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { ink } from '@tumbaland/frontend-core';
import type { ConversationMember, ReadReceipt, ThreadMessage } from '../../types';
import { DaySeparator } from './DaySeparator';
import { MessageBubble } from './MessageBubble';
import { SeenMarker, placeSeenMarkers } from './SeenMarker';
import { clockTime } from './clock';

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
  onOpenAlbum?: (albumId: string) => void;
  onEditAlbum?: (messageId: string) => void;
  /** For senders' pictures and the "seen" markers. */
  members?: ConversationMember[];
  /** How far each of the others has read. */
  reads?: Record<string, ReadReceipt>;
}

const NO_MEMBERS: ConversationMember[] = [];
const NO_READS: Record<string, ReadReceipt> = {};

/** How close to the bottom still counts as "following the conversation". */
const NEAR_BOTTOM_PX = 120;

const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();

/** "Irja set photos to go to Rome": a note about the conversation, not a message in it. */
function SystemLine({ message }: { message: ThreadMessage }) {
  return (
    <Typography
      variant="caption"
      component="p"
      sx={{ textAlign: 'center', color: ink.muted, my: 1.5, px: 2 }}
    >
      {message.body} · {clockTime(message.createdAt)}
    </Typography>
  );
}

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
  onOpenMedia,
  onOpenAlbum,
  onEditAlbum,
  members = NO_MEMBERS,
  reads = NO_READS
}: MessageListProps) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const content = useRef<HTMLDivElement | null>(null);

  /**
   * Straight to the newest message.
   *
   * Sets the list's own scroll offset rather than calling `scrollIntoView`,
   * which also scrolls every scrollable ancestor -- including the shell's
   * page -- and left the thread part-way down on open.
   */
  const scrollToBottom = useCallback((smooth = false) => {
    const element = scroller.current;
    if (!element) return;
    if (smooth && typeof element.scrollTo === 'function') {
      element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
    } else {
      element.scrollTop = element.scrollHeight;
    }
  }, []);

  const pictures = useMemo(() => new Map(members.map((member) => [member.userId, member.picture])), [members]);
  const seen = useMemo(() => placeSeenMarkers(messages, reads, members), [messages, reads, members]);
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
      scrollToBottom();
    }
  }, [messages, atBottom, scrollToBottom]);

  // The first render lands at the bottom without animating there.
  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  /**
   * Keeps the newest message in view while the thread settles.
   *
   * Photos, video posters and pictures arrive after the first render and push
   * the content taller, so a thread that opened at the bottom ended up
   * somewhere in the middle. The keyboard opening shrinks the list from below
   * and does the same. Both are followed only while the reader is at the
   * bottom: someone scrolled up to read something older stays where they are.
   */
  useEffect(() => {
    const element = scroller.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      if (atBottomRef.current) element.scrollTop = element.scrollHeight;
    });
    observer.observe(element);
    if (content.current) observer.observe(content.current);
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
        <Box ref={content}>
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
            if (message.kind === 'system') {
              return (
                <Box key={message.clientId || message.id}>
                  {newDay && <DaySeparator iso={message.createdAt} />}
                  <SystemLine message={message} />
                </Box>
              );
            }

            const showSender =
              newDay ||
              !previous ||
              previous.kind === 'system' ||
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
                  onOpenAlbum={onOpenAlbum}
                  onEditAlbum={onEditAlbum}
                  senderPicture={pictures.get(message.senderId)}
                />
                {seen.has(message.id) && <SeenMarker seers={seen.get(message.id)!} />}
              </Box>
            );
          })}
        </Box>
      </Box>

      {unread && (
        <Fab
          size="small"
          aria-label="Jump to latest"
          onClick={() => scrollToBottom(true)}
          sx={{ position: 'absolute', right: 16, bottom: 16, bgcolor: 'background.paper' }}
        >
          <KeyboardArrowDownIcon />
        </Fab>
      )}
    </Box>
  );
}
