import { useRef, useState, type MouseEvent } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddReactionOutlinedIcon from '@mui/icons-material/AddReactionOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import PhotoAlbumOutlinedIcon from '@mui/icons-material/PhotoAlbumOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { brand, ink, surface } from '@tumbaland/frontend-core';
import { chatColors } from './themes';
import { linkify } from './linkify';
import type { ThreadMessage } from '../../types';
import { MediaGrid } from './MediaGrid';
import { BubbleEffect } from './BubbleEffect';
import { ReactionRow } from './ReactionRow';
import { MemberAvatar } from './MemberAvatar';
import { clockTime } from './clock';

export interface MessageBubbleProps {
  message: ThreadMessage;
  mine: boolean;
  /** Hidden when the message above is from the same person in the same minute. */
  showSender: boolean;
  /** The sender's picture, shown beside their name. */
  senderPicture?: string | null;
  /** The sender's current name. Falls back to the one saved on the message. */
  senderName?: string;
  onReact: (messageId: string, emoji: string) => void;
  onRetry: (clientId: string) => void;
  onPickEmoji: (messageId: string, anchor: HTMLElement) => void;
  onOpenMedia: (message: ThreadMessage, index: number) => void;
  /** Opens the album a photo was saved to. Without it the mark is not drawn. */
  onOpenAlbum?: (albumId: string) => void;
  /** Moves this message's photos to another album: the pencil beside the mark. */
  onEditAlbum?: (messageId: string) => void;
  /** Your own bubbles' colour, from the conversation's theme. */
  accent?: string;
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

/** Whether the sender may still edit or unsend this message. */
export function canChange(message: ThreadMessage, mine: boolean): boolean {
  const stored = message.delivery !== 'pending' && message.delivery !== 'failed';
  return mine && stored && !message.deletedAt && message.kind !== 'system';
}

/** How long a touch must be held before it counts as a long press. */
const LONG_PRESS_MS = 450;

/**
 * The text, with its web addresses as links. They open in a new tab, so a
 * conversation is never navigated away from, and send no referrer: the page
 * on the other end has no business knowing which chat it was shared in.
 */
function MessageText({ text, mine }: { text: string; mine: boolean }) {
  return (
    <>
      {linkify(text).map((part, index) =>
        part.kind === 'text' ? (
          part.text
        ) : (
          <Link
            key={index}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            // A long press on a bubble opens the reaction picker. On a link
            // the browser's own long press (preview, copy) is the one wanted.
            onTouchStart={(event) => event.stopPropagation()}
            sx={{
              color: mine ? 'inherit' : chatColors.link,
              textDecorationColor: 'currentColor',
              textUnderlineOffset: '2px',
              // A long address with nowhere to break would widen the bubble
              // past the screen.
              overflowWrap: 'anywhere'
            }}
          >
            {part.text}
          </Link>
        )
      )}
    </>
  );
}

export function MessageBubble({
  message,
  mine,
  showSender,
  senderPicture,
  senderName,
  onReact,
  onRetry,
  onPickEmoji,
  onOpenMedia,
  onOpenAlbum,
  onEditAlbum,
  accent = brand.pinkInk
}: MessageBubbleProps) {
  const saved = message.deletedAt ? undefined : message.attachments.find((attachment) => attachment.albumId);
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, ml: 0.5, mb: 0.5 }}>
          <MemberAvatar name={senderName || message.senderName || message.senderEmail} picture={senderPicture} size={22} />
          <Typography variant="caption" sx={{ color: ink.muted }}>
            {senderName || message.senderName || message.senderEmail}
          </Typography>
        </Box>
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
              bgcolor: jumbo ? 'transparent' : mine ? accent : chatColors.other,
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
                Message unsent
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
                    <MessageText text={message.body} mine={mine} />
                  </Typography>
                )}
              </>
            )}
          </Box>

          {message.effect && !message.deletedAt && <BubbleEffect effect={message.effect} mine={mine} />}

          {/* Desktop affordance. Touch reaches the same popover, Edit and
              Unsend included, by a long press on the bubble. */}
          {hovered && !message.deletedAt && !pending && (
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                flexDirection: mine ? 'row-reverse' : 'row',
                ...(mine ? { right: '100%', mr: 0.5 } : { left: '100%', ml: 0.5 })
              }}
            >
              <IconButton
                size="small"
                aria-label="Add reaction"
                onClick={(event: MouseEvent<HTMLElement>) => onPickEmoji(message.id, event.currentTarget)}
                sx={{ color: ink.muted }}
              >
                <AddReactionOutlinedIcon fontSize="small" />
              </IconButton>
              {canChange(message, mine) && (
                <IconButton
                  size="small"
                  aria-label="Message options"
                  onClick={(event: MouseEvent<HTMLElement>) => onPickEmoji(message.id, event.currentTarget)}
                  sx={{ color: ink.muted }}
                >
                  <MoreHorizIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          )}
        </Box>
      </Box>

      {/* Straight under the bubble, before the album line: a reaction is to
          the message, and under "In Album" it read as belonging to that. */}
      {message.reactions.length > 0 && (
        <ReactionRow reactions={message.reactions} mine={mine} onToggle={(emoji) => onReact(message.id, emoji)} />
      )}

      {saved && onOpenAlbum && (
        <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
          <Box
            component="button"
            type="button"
            onClick={() => onOpenAlbum(saved.albumId!)}
            aria-label={`In ${saved.albumName ?? 'album'}. Open album`}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              mx: 1,
              mt: 0.25,
              p: 0,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              font: 'inherit',
              fontSize: 11,
              color: ink.muted,
              '&:hover': { color: brand.pinkInk, textDecoration: 'underline' }
            }}
          >
            <PhotoAlbumOutlinedIcon sx={{ fontSize: 13 }} />
            In {saved.albumName ?? 'album'}
          </Box>
          {onEditAlbum && (
            <IconButton
              size="small"
              aria-label="Change album"
              onClick={() => onEditAlbum(message.id)}
              sx={{ p: 0.25, color: ink.muted, '&:hover': { color: brand.pinkInk } }}
            >
              <EditOutlinedIcon sx={{ fontSize: 13 }} />
            </IconButton>
          )}
        </Box>
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
              {clockTime(message.createdAt)}
              {message.editedAt && ' · edited'}
            </Typography>
          </>
        )}
      </Box>
    </Box>
  );
}
