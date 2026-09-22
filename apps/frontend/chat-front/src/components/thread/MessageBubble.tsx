import { useRef, useState, type MouseEvent } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddReactionOutlinedIcon from '@mui/icons-material/AddReactionOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { brand, ink, surface } from '@tumbaland/frontend-core';
import type { ThreadMessage } from '../../types';
import { MediaGrid } from './MediaGrid';
import { ReactionRow } from './ReactionRow';

export interface MessageBubbleProps {
  message: ThreadMessage;
  mine: boolean;
  /** Hidden when the message above is from the same person in the same minute. */
  showSender: boolean;
  onReact: (messageId: string, emoji: string) => void;
  onRetry: (clientId: string) => void;
  onPickEmoji: (messageId: string, anchor: HTMLElement) => void;
  onOpenMedia: (message: ThreadMessage, index: number) => void;
}

/**
 * How many code points still count as "just emoji".
 *
 * A message that is only emoji is drawn large and without a bubble. It is a
 * small thing and it is most of what makes a chat feel like a chat rather than
 * a comment thread.
 */
const JUMBO_LIMIT = 3;

/** Whether the body is nothing but emoji, in a small enough quantity. */
export function isJumbo(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed) return false;

  const points = [...trimmed];
  if (points.length > JUMBO_LIMIT * 4) return false;

  // Extended_Pictographic covers emoji proper; the rest of the class allows the
  // joiners, skin-tone modifiers and variation selectors a single emoji is
  // built from, so a thumbs-up with a tone is one emoji rather than three.
  const emojiOnly = /^(\p{Extended_Pictographic}|\p{Emoji_Component}|\u200d|\ufe0f|\s)+$/u;
  if (!emojiOnly.test(trimmed)) return false;

  const glyphs = [...trimmed.replace(/\s/g, '')].filter((point) =>
    /\p{Extended_Pictographic}/u.test(point)
  ).length;
  return glyphs > 0 && glyphs <= JUMBO_LIMIT;
}

/**
 * 24-hour HH:mm, whatever the browser's language. A phone set to English
 * would otherwise show "02:05 PM", which is not how anyone here reads a clock.
 */
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** How long a touch must be held before it counts as a long press. */
const LONG_PRESS_MS = 450;

export function MessageBubble({
  message,
  mine,
  showSender,
  onReact,
  onRetry,
  onPickEmoji,
  onOpenMedia
}: MessageBubbleProps) {
  const [hovered, setHovered] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Touch has no hover, so the reaction button beside the bubble can never
   * appear there. A long press is the gesture every other chat app uses for
   * the same thing.
   */
  const startPress = (event: React.TouchEvent<HTMLElement>) => {
    if (message.deletedAt || pending) return;
    const anchor = event.currentTarget;
    pressTimer.current = setTimeout(() => onPickEmoji(message.id, anchor), LONG_PRESS_MS);
  };

  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };
  const jumbo = !message.deletedAt && message.attachments.length === 0 && isJumbo(message.body);
  // A bubble that is only media gets no padding: the grid is the bubble.
  const mediaOnly = !message.deletedAt && message.attachments.length > 0 && !message.body.trim();
  const pending = message.delivery === 'pending';
  const failed = message.delivery === 'failed';

  return (
    <Box
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: mine ? 'flex-end' : 'flex-start',
        mt: showSender ? 1.5 : 0.25,
        px: 0.5
      }}
    >
      {showSender && !mine && (
        <Typography variant="caption" sx={{ color: ink.muted, ml: 1.5, mb: 0.25 }}>
          {message.senderName || message.senderEmail}
        </Typography>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: mine ? 'flex-end' : 'flex-start', width: '100%' }}>
        <Box
          sx={{
            position: 'relative',
            width: 'fit-content',
            maxWidth: 'min(78%, 34rem)',
            ml: mine ? 5 : 0,
            mr: mine ? 0 : 5
          }}
        >
          <Box
            onTouchStart={startPress}
            onTouchEnd={cancelPress}
            // A scroll must not fire the picker, and neither should lifting a
            // finger somewhere else.
            onTouchMove={cancelPress}
            onTouchCancel={cancelPress}
            sx={{
              maxWidth: '100%',
              borderRadius: 3,
              px: jumbo || mediaOnly ? 0 : 1.5,
              py: jumbo || mediaOnly ? 0 : 1,
              overflow: 'hidden',
              bgcolor: jumbo ? 'transparent' : mine ? brand.pinkInk : surface.paper,
              color: jumbo ? 'inherit' : mine ? '#fff' : ink.body,
              border: jumbo || mine ? 'none' : `1px solid ${surface.sunken}`,
              // A pending message is drawn faintly rather than with a spinner:
              // on a good connection it is confirmed before a spinner would
              // finish one rotation, and a flicker is worse than a shade.
              opacity: pending ? 0.6 : 1,
              transition: 'opacity .15s ease',
              wordBreak: 'break-word'
            }}
          >
            {message.deletedAt ? (
              <Typography variant="body2" sx={{ fontStyle: 'italic', color: ink.muted }}>
                Message deleted
              </Typography>
            ) : (
              <>
                {message.attachments.length > 0 && (
                  <MediaGrid
                    attachments={message.attachments}
                    onOpen={(index) => onOpenMedia(message, index)}
                  />
                )}
                {message.body && (
                  <Typography
                    variant={jumbo ? 'h3' : 'body2'}
                    component="p"
                    sx={{ whiteSpace: 'pre-wrap', lineHeight: jumbo ? 1.1 : 1.45 }}
                  >
                    {message.body}
                  </Typography>
                )}
              </>
            )}
          </Box>

          {/* Desktop affordance. Touch reaches the same picker by long press on
              the bubble, handled by the list. */}
          {hovered && !message.deletedAt && !pending && (
            <IconButton
              size="small"
              aria-label="Add reaction"
              onClick={(event: MouseEvent<HTMLElement>) => onPickEmoji(message.id, event.currentTarget)}
              sx={{
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                ...(mine ? { right: '100%', mr: 0.5 } : { left: '100%', ml: 0.5 }),
                color: ink.muted
              }}
            >
              <AddReactionOutlinedIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      </Box>

      {message.reactions.length > 0 && (
        <ReactionRow reactions={message.reactions} mine={mine} onToggle={(emoji) => onReact(message.id, emoji)} />
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mx: 1, mt: 0.25 }}>
        {failed ? (
          <>
            <ErrorOutlineIcon sx={{ fontSize: 13, color: 'error.main' }} />
            <Typography
              variant="caption"
              role="button"
              tabIndex={0}
              onClick={() => onRetry(message.clientId)}
              onKeyDown={(event) => event.key === 'Enter' && onRetry(message.clientId)}
              sx={{ color: 'error.main', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Not sent. Tap to retry
            </Typography>
          </>
        ) : (
          <>
            {pending && (
              <Tooltip title="Sending">
                <ScheduleIcon sx={{ fontSize: 12, color: ink.muted }} />
              </Tooltip>
            )}
            <Typography variant="caption" sx={{ color: ink.muted, fontSize: 11 }}>
              {time(message.createdAt)}
              {message.editedAt && ' · edited'}
            </Typography>
          </>
        )}
      </Box>
    </Box>
  );
}
