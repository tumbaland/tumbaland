import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Fab from '@mui/material/Fab';
import Typography from '@mui/material/Typography';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { keyframes } from '@mui/material/styles';
import { brand, ink } from '@tumbaland/frontend-core';
import type { Bot, ConversationMember, ReadReceipt, ThreadMessage } from '../../types';
import { CollageCard } from './CollageCard';
import { ReminderCard } from './ReminderCard';
import { DaySeparator } from './DaySeparator';
import { MessageBubble } from './MessageBubble';
import type { QuoteView } from './QuoteBlock';
import { messageSummary } from '../../services/summary';
import { SeenMarker, placeSeenMarkers } from './SeenMarker';
import { clockTime } from './clock';
import { chatColors } from './themes';

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
  onRemoveFromAlbum?: (messageId: string) => void;
  /** Join on a collage card: opens that collage in Album. */
  onOpenCollage?: (collageId: string) => void;
  /** A reminder card's Open: the plan in the journal's calendar. */
  onOpenPlan?: (planId: string) => void;
  /** Starts a reply to a message. */
  onReply?: (messageId: string) => void;
  /** A tap on a reply's quote: brings the original into view, loading back to it if need be. */
  onOpenQuote?: (messageId: string, createdAt: string) => void;
  /** Your own bubbles' colour, from the conversation's theme. */
  accent?: string;
  /** For senders' pictures and the "seen" markers. */
  members?: ConversationMember[];
  /** The chat's assistants, so what they wrote is drawn in their colour and labelled. */
  bots?: Bot[];
  /** A tap on an assistant's name above what it wrote. */
  onOpenBot?: (botId: string) => void;
  /** How far each of the others has read. */
  reads?: Record<string, ReadReceipt>;
  /**
   * A message to bring into view and flash, such as a search result. A new
   * `key` repeats it for the same message.
   */
  focus?: { id: string; key: number } | null;
}

const NO_MEMBERS: ConversationMember[] = [];
const NO_BOTS: Bot[] = [];
/** An assistant that has been removed: its messages stay, in a neutral grey that reads on any theme. */
const GONE_BOT_COLOR = '#6b7280';
const NO_READS: Record<string, ReadReceipt> = {};

/** How close to the bottom still counts as "following the conversation". */
const NEAR_BOTTOM_PX = 120;

/** The flash on a message opened from search, so the eye finds it among the rest. */
const focusFlash = keyframes`
  0%, 60% { background-color: color-mix(in srgb, ${brand.pinkInk} 22%, transparent); }
  100% { background-color: transparent; }
`;
const FOCUS_FLASH_MS = 2000;

const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();

/** "Irja set photos to go to Rome": a note about the conversation, not a message in it. */
function SystemLine({ message }: { message: ThreadMessage }) {
  return (
    <Typography
      variant="caption"
      component="p"
      sx={{ textAlign: 'center', color: ink.muted, textShadow: chatColors.metaHalo, my: 1.5, px: 2 }}
    >
      {message.body} · {clockTime(message.createdAt)}
    </Typography>
  );
}

/** What a double tap on a message sends. */
const LOVE = '❤️';
/** How long a heart is given to reach the server before another double tap counts. */
const LOVE_SETTLE_MS = 2000;

/** Consecutive messages from one person within two minutes are grouped. */
const GROUP_WINDOW_MS = 2 * 60 * 1000;

/** Whether `next` carries on the group `message` is in: same person, same day, within the window. */
function continues(message: ThreadMessage, next: ThreadMessage | undefined): boolean {
  return (
    Boolean(next) &&
    message.kind !== 'system' &&
    message.kind !== 'collage' &&
    message.kind !== 'reminder' &&
    next!.kind !== 'system' &&
    next!.kind !== 'collage' &&
    next!.kind !== 'reminder' &&
    next!.senderId === message.senderId &&
    sameDay(message.createdAt, next!.createdAt) &&
    new Date(next!.createdAt).getTime() - new Date(message.createdAt).getTime() <= GROUP_WINDOW_MS
  );
}

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
  onRemoveFromAlbum,
  onOpenCollage,
  onOpenPlan,
  accent,
  members = NO_MEMBERS,
  bots = NO_BOTS,
  onOpenBot,
  onReply,
  onOpenQuote,
  reads = NO_READS,
  focus = null
}: MessageListProps) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const content = useRef<HTMLDivElement | null>(null);

  /**
   * Whether the list follows the newest message: true until the reader
   * scrolls up away from it. Read by the resize observer, which outlives any
   * one render.
   */
  const atBottomRef = useRef(true);
  /** Where the list was at the last scroll event, to tell the reader's scrolls from the content's. */
  const lastScrollTop = useRef(0);

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
      // Recorded here too, so the next upward move is measured from where this
      // left the list even if its own scroll event is merged away.
      lastScrollTop.current = element.scrollTop;
    }
  }, []);

  const pictures = useMemo(() => new Map(members.map((member) => [member.userId, member.picture])), [members]);
  // Their name now, not the one saved on each message when it was sent, so a
  // name changed on the account page shows on old messages too.
  const names = useMemo(() => new Map(members.map((member) => [member.userId, member.name])), [members]);
  const seen = useMemo(() => placeSeenMarkers(messages, reads, members), [messages, reads, members]);
  // What an assistant is called and coloured now, not when it wrote: a rename shows on its old messages too.
  const botsById = useMemo(() => new Map(bots.map((bot) => [bot.id, bot])), [bots]);
  const botOf = (message: ThreadMessage): { id?: string; name: string; color: string } | null => {
    if (!message.botId) return null;
    const bot = botsById.get(message.botId);
    return bot ? { id: bot.id, name: bot.name, color: bot.color } : { name: message.senderName, color: GONE_BOT_COLOR };
  };

  /**
   * A double-tapped message gets a heart. Only ever adds one: a reaction
   * toggles, and a second double tap taking the heart off would be a surprise.
   */
  const loving = useRef(new Set<string>());
  const love = (messageId: string) => {
    const target = byId.get(messageId);
    const already = target?.reactions.some((reaction) => reaction.userId === currentUserId && reaction.emoji === LOVE);
    // Reactions are not shown until the server answers, so a second double tap
    // in that time would still see none and toggle the first one off.
    if (already || loving.current.has(messageId)) return;
    loving.current.add(messageId);
    setTimeout(() => loving.current.delete(messageId), LOVE_SETTLE_MS);
    onReact(messageId, LOVE);
  };
  const byId = useMemo(() => new Map(messages.map((message) => [message.id, message])), [messages]);

  /**
   * What a reply quotes. The original itself when it is loaded, so an edit or
   * an unsend shows at once; the copy the server keeps on the reply when it is
   * further back than the thread has loaded.
   */
  const quoteFor = (message: ThreadMessage): QuoteView | null => {
    if (!message.replyTo) return null;
    const parent = byId.get(message.replyTo);
    const kept = message.quote;
    if (!parent && !kept) return { name: '', text: 'An earlier message', unsent: false };
    const senderId = parent?.senderId ?? kept!.senderId;
    const name =
      senderId === currentUserId ? 'You' : names.get(senderId) || parent?.senderName || kept?.senderName || '';
    const unsent = parent ? Boolean(parent.deletedAt) : Boolean(kept?.deleted);
    const createdAt = parent?.createdAt ?? kept!.createdAt;
    return {
      name,
      text: parent ? messageSummary(parent) : kept!.text,
      unsent,
      onOpen: !unsent && onOpenQuote ? () => onOpenQuote(message.replyTo!, createdAt) : undefined
    };
  };
  const [atBottom, setAtBottom] = useState(true);

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
    const movedUp = element.scrollTop < lastScrollTop.current - 1;
    lastScrollTop.current = element.scrollTop;

    // Only the reader scrolling up lets go of the bottom. Measuring the
    // distance alone got this wrong on open: the scroll event from our own
    // jump to the bottom can be handled after a batch of photos has loaded
    // above it, so the distance was suddenly large, the list decided the
    // reader had left, stopped following, and the thread opened part-way up.
    // Content growing never moves the offset up; a reader scrolling does.
    if (distance < NEAR_BOTTOM_PX) atBottomRef.current = true;
    else if (movedUp) atBottomRef.current = false;
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
    if (grewAtBottom && atBottomRef.current) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  /**
   * Brings the focused message to the middle of the list once it is there.
   *
   * After the prepend handling above, which may have just followed the
   * bottom; this then lets go of the bottom, so photos loading below do not
   * pull the list back down past the message being looked for.
   */
  const handledFocus = useRef<number | null>(null);
  const [flashing, setFlashing] = useState<string | null>(null);
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!focus || !element || handledFocus.current === focus.key) return;
    const target = element.querySelector<HTMLElement>(`[data-message-id="${focus.id}"]`);
    if (!target) return;
    handledFocus.current = focus.key;

    atBottomRef.current = false;
    setAtBottom(false);
    const offset = target.getBoundingClientRect().top - element.getBoundingClientRect().top;
    element.scrollTop += offset - (element.clientHeight - target.offsetHeight) / 2;
    lastScrollTop.current = element.scrollTop;
    setFlashing(focus.id);
  }, [focus, messages]);

  useEffect(() => {
    if (!flashing) return;
    const timer = setTimeout(() => setFlashing(null), FOCUS_FLASH_MS);
    return () => clearTimeout(timer);
  }, [flashing]);

  /** Each message's row: findable by id, and flashing when it is the one opened. */
  const rowProps = (message: ThreadMessage) => ({
    'data-message-id': message.id,
    sx:
      flashing === message.id
        ? { borderRadius: 2, animation: `${focusFlash} ${FOCUS_FLASH_MS}ms ease-out` }
        : undefined
  });

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
      if (!atBottomRef.current) return;
      element.scrollTop = element.scrollHeight;
      lastScrollTop.current = element.scrollTop;
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
                <Box key={message.clientId || message.id} {...rowProps(message)}>
                  {newDay && <DaySeparator iso={message.createdAt} />}
                  <SystemLine message={message} />
                </Box>
              );
            }
            if (message.kind === 'collage' && message.collage && !message.deletedAt) {
              return (
                <Box key={message.clientId || message.id} {...rowProps(message)}>
                  {newDay && <DaySeparator iso={message.createdAt} />}
                  <CollageCard
                    message={message}
                    mine={message.senderId === currentUserId}
                    onJoin={(collageId) => onOpenCollage?.(collageId)}
                  />
                  {seen.has(message.id) && <SeenMarker seers={seen.get(message.id)!} />}
                </Box>
              );
            }

            if (message.kind === 'reminder' && message.plan && !message.deletedAt) {
              return (
                <Box key={message.clientId || message.id} {...rowProps(message)}>
                  {newDay && <DaySeparator iso={message.createdAt} />}
                  <ReminderCard message={message} onOpen={(planId) => onOpenPlan?.(planId)} />
                  {seen.has(message.id) && <SeenMarker seers={seen.get(message.id)!} />}
                </Box>
              );
            }

            const showSender = !previous || !continues(previous, message);
            // A run of messages sent together is timed once, under its last.
            const showTime = !continues(message, messages[index + 1]);

            return (
              <Box key={message.clientId || message.id} {...rowProps(message)}>
                {newDay && <DaySeparator iso={message.createdAt} />}
                <MessageBubble
                  message={message}
                  mine={message.senderId === currentUserId}
                  showSender={showSender}
                  showTime={showTime}
                  onReact={onReact}
                  onRetry={onRetry}
                  onPickEmoji={onPickEmoji}
                  onOpenMedia={onOpenMedia}
                  onOpenAlbum={onOpenAlbum}
                  onEditAlbum={onEditAlbum}
                  onRemoveFromAlbum={onRemoveFromAlbum}
                  accent={accent}
                  quote={quoteFor(message)}
                  onReply={onReply}
                  onLove={love}
                  senderPicture={pictures.get(message.senderId)}
                  senderName={names.get(message.senderId)}
                  bot={botOf(message)}
                  onOpenBot={onOpenBot}
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
