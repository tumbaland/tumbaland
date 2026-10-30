import { useState, type MouseEvent } from 'react';
import { keyframes } from '@mui/material/styles';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddReactionOutlinedIcon from '@mui/icons-material/AddReactionOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import PhotoAlbumOutlinedIcon from '@mui/icons-material/PhotoAlbumOutlined';
import RemoveCircleOutlinedIcon from '@mui/icons-material/RemoveCircleOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ReplyIcon from '@mui/icons-material/Reply';
import { brand, ink, surface } from '@tumbaland/frontend-core';
import { chatColors } from './themes';
import type { ThreadMessage } from '../../types';
import { DocumentCard } from './DocumentCard';
import { QuoteBlock, type QuoteView } from './QuoteBlock';
import { MessageText } from './MessageText';
import { SWIPE_REPLY_PX, useBubbleGestures } from '../../hooks/useBubbleGestures';
import { albumLabel, canChange, isJumbo } from './messageBubbleUtils';
import { MediaGrid } from './MediaGrid';
import { isDocumentType } from '../../services/documents';
import { isAudioType, isVisualType } from '../../services/voice';
import { VoiceNote } from './VoiceNote';
import { BubbleEffect } from './BubbleEffect';
import { ReactionRow } from './ReactionRow';
import { BotAvatar } from './BotAvatar';
import { MemberAvatar } from './MemberAvatar';
import { clockTime } from './clock';

export interface MessageBubbleProps {
  message: ThreadMessage;
  mine: boolean;
  /**
   * The name and picture above someone else's message. Hidden when the message
   * above is from the same person in the same minute.
   */
  showSender: boolean;
  /**
   * False for a message with another from the same person right after it,
   * which shows the time for both. Defaults to true. Sending, failed and
   * edited messages show their line regardless.
   */
  showTime?: boolean;
  /** The sender's picture, shown beside their name. */
  senderPicture?: string | null;
  /** The sender's current name. Falls back to the one saved on the message. */
  senderName?: string;
  /**
   * Set when an assistant wrote it: its name and colour, from the chat's bots,
   * or neutral ones when it has since been removed. Drawn as an assistant, with
   * an "AI" label, so nobody mistakes it for a person.
   */
  bot?: { name: string; color: string } | null;
  onReact: (messageId: string, emoji: string) => void;
  onRetry: (clientId: string) => void;
  onPickEmoji: (messageId: string, anchor: HTMLElement) => void;
  onOpenMedia: (message: ThreadMessage, index: number) => void;
  /** Opens the album a photo was saved to. Without it the mark is not drawn. */
  onOpenAlbum?: (albumId: string) => void;
  /** Moves this message's photos to another album: the pencil beside the mark. */
  onEditAlbum?: (messageId: string) => void;
  /** Takes this message's photos out of their album, leaving them in chat: the minus beside the pencil. */
  onRemoveFromAlbum?: (messageId: string) => void;
  /** Your own bubbles' colour, from the conversation's theme. */
  accent?: string;
  /** On a reply: the message it answers, worked out by the list. */
  quote?: QuoteView | null;
  /** Starts a reply to this message: the hover button, and a swipe right on touch. */
  onReply?: (messageId: string) => void;
  /** A double tap (or double click): a heart on this message. */
  onLove?: (messageId: string) => void;
}

/**
 * The album's pencil and minus, on a device with a mouse: there only while
 * the message is pointed at or they have the keyboard's focus, so a thread of
 * saved photos is not lined with them. Touch has no hover and keeps them.
 */
const revealOnHover = (hovered: boolean) => ({
  '@media (hover: hover)': { opacity: hovered ? 1 : 0, '&:focus-visible': { opacity: 1 } }
});

/** The heart a double tap leaves: it swells over the bubble and goes. */
const heartBurst = keyframes`
  0% { transform: scale(0.3); opacity: 0; }
  25% { transform: scale(1.2); opacity: 1; }
  45% { transform: scale(0.95); }
  70% { transform: scale(1); opacity: 1; }
  100% { transform: scale(1.1) translateY(-12px); opacity: 0; }
`;
const heartFade = keyframes`
  0%, 60% { opacity: 1; }
  100% { opacity: 0; }
`;

export function MessageBubble({
  message,
  mine,
  showSender,
  showTime = true,
  senderPicture,
  senderName,
  bot,
  onReact,
  onRetry,
  onPickEmoji,
  onOpenMedia,
  onOpenAlbum,
  onEditAlbum,
  onRemoveFromAlbum,
  accent = brand.pinkInk,
  quote,
  onReply,
  onLove
}: MessageBubbleProps) {
  const saved = message.deletedAt ? undefined : message.attachments.find((attachment) => attachment.albumId);
  const albumLine = saved ? albumLabel(message.attachments) : '';
  const [hovered, setHovered] = useState(false);
  const pending = message.delivery === 'pending';
  const failed = message.delivery === 'failed';
  const canReply = Boolean(onReply) && !message.deletedAt && !pending && !failed;
  const { dragX, hearts, handlers } = useBubbleGestures({
    messageId: message.id,
    canPick: !message.deletedAt && !pending,
    canReply,
    canLove: !message.deletedAt && !pending && !failed,
    onPickEmoji,
    onReply,
    onLove
  });
  const documents = message.deletedAt ? [] : message.attachments.filter((a) => isDocumentType(a.mimetype));
  const voices = message.deletedAt ? [] : message.attachments.filter((a) => isAudioType(a.mimetype));
  const media = message.deletedAt ? [] : message.attachments.filter((a) => isVisualType(a.mimetype));
  const showQuote = Boolean(quote) && !message.deletedAt;
  // A quote needs the bubble around it, so an emoji reply is drawn as text.
  const jumbo = !message.deletedAt && !showQuote && message.attachments.length === 0 && isJumbo(message.body);
  // A bubble that is only media gets no padding: the grid is the bubble.
  const mediaOnly =
    !message.deletedAt &&
    !showQuote &&
    media.length > 0 &&
    documents.length === 0 &&
    voices.length === 0 &&
    !message.body.trim();

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
      {showSender && !mine && bot && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, ml: 0.5, mb: 0.5 }}>
          <BotAvatar color={bot.color} size={22} />
          <Typography variant="caption" sx={{ color: ink.muted }}>
            {bot.name}
          </Typography>
          <Box
            component="span"
            aria-label="Assistant"
            sx={{ bgcolor: bot.color, color: '#fff', borderRadius: 0.75, px: 0.5, fontSize: 10, fontWeight: 700, lineHeight: '15px', letterSpacing: '0.04em' }}
          >
            AI
          </Box>
        </Box>
      )}
      {showSender && !mine && !bot && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, ml: 0.5, mb: 0.5 }}>
          <MemberAvatar name={senderName || message.senderName || message.senderEmail} picture={senderPicture} size={22} />
          <Typography variant="caption" sx={{ color: ink.muted }}>
            {senderName || message.senderName || message.senderEmail}
          </Typography>
        </Box>
      )}

      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: mine ? 'flex-end' : 'flex-start',
          width: '100%'
        }}
      >
        {dragX > 0 && (
          <ReplyIcon
            aria-hidden
            sx={{
              position: 'absolute',
              left: 4,
              fontSize: 20,
              color: ink.muted,
              opacity: Math.min(1, dragX / SWIPE_REPLY_PX),
              transform: `scale(${dragX >= SWIPE_REPLY_PX ? 1.15 : 0.85})`,
              transition: 'transform .12s ease'
            }}
          />
        )}
        <Box
          sx={{
            position: 'relative',
            width: 'fit-content',
            maxWidth: 'min(78%, 34rem)',
            ml: mine ? 5 : 0,
            mr: mine ? 0 : 5,
            transform: dragX ? `translateX(${dragX}px)` : undefined,
            transition: dragX ? 'none' : 'transform .18s ease'
          }}
        >
          <Box
            {...handlers}
            sx={{
              // Sideways is this bubble's (a swipe to reply); scrolling and
              // pinching stay the page's.
              touchAction: 'pan-y pinch-zoom',
              maxWidth: '100%',
              borderRadius: 3,
              px: jumbo || mediaOnly ? 0 : 1.5,
              py: jumbo || mediaOnly ? 0 : 1,
              overflow: 'hidden',
              bgcolor: jumbo ? 'transparent' : mine ? accent : chatColors.other,
              color: jumbo ? 'inherit' : mine ? '#fff' : ink.body,
              // An assistant's bubble has an edge in its own colour, so a thread with two of
              // them and two people reads at a glance.
              border: jumbo || mine ? 'none' : `1px solid ${bot ? `${bot.color}66` : surface.sunken}`,
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
                {showQuote && quote && <QuoteBlock quote={quote} mine={mine} />}
                {media.length > 0 && (
                  // The lightbox indexes the whole message, documents included.
                  <MediaGrid
                    attachments={media}
                    onOpen={(index) => onOpenMedia(message, message.attachments.indexOf(media[index]!))}
                  />
                )}
                {voices.map((attachment) => (
                  <VoiceNote key={attachment.fileId} attachment={attachment} mine={mine} />
                ))}
                {documents.map((attachment) => (
                  <DocumentCard key={attachment.fileId} attachment={attachment} />
                ))}
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

          {hearts > 0 && (
            <Box
              key={hearts}
              aria-hidden
              data-testid="heart-burst"
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                pointerEvents: 'none',
                fontSize: 44,
                lineHeight: 1,
                animation: `${heartBurst} 800ms ease-out forwards`,
                '@media (prefers-reduced-motion: reduce)': { animation: `${heartFade} 800ms ease-out forwards` }
              }}
            >
              ❤️
            </Box>
          )}

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
              {canReply && (
                <IconButton
                  size="small"
                  aria-label="Reply"
                  onClick={() => onReply?.(message.id)}
                  sx={{ color: ink.muted }}
                >
                  <ReplyIcon fontSize="small" />
                </IconButton>
              )}
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
            aria-label={`${albumLine}. Open album`}
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
              textShadow: chatColors.metaHalo,
              '&:hover': { color: brand.pinkInk, textDecoration: 'underline' }
            }}
          >
            <PhotoAlbumOutlinedIcon sx={{ fontSize: 13 }} />
            {albumLine}
          </Box>
          {onEditAlbum && (
            <IconButton
              size="small"
              aria-label="Change album"
              onClick={() => onEditAlbum(message.id)}
              sx={{ p: 0.25, color: ink.muted, '&:hover': { color: brand.pinkInk }, ...revealOnHover(hovered) }}
            >
              <EditOutlinedIcon sx={{ fontSize: 13 }} />
            </IconButton>
          )}
          {onRemoveFromAlbum && (
            <IconButton
              size="small"
              aria-label="Remove from album"
              onClick={() => onRemoveFromAlbum(message.id)}
              sx={{ p: 0.25, color: ink.muted, '&:hover': { color: 'error.main' }, ...revealOnHover(hovered) }}
            >
              <RemoveCircleOutlinedIcon sx={{ fontSize: 13 }} />
            </IconButton>
          )}
        </Box>
      )}

      {(showTime || failed || pending || message.editedAt) && (
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
              <Typography variant="caption" sx={{ color: ink.muted, fontSize: 11, textShadow: chatColors.metaHalo }}>
                {clockTime(message.createdAt)}
                {message.editedAt && ' · edited'}
              </Typography>
            </>
          )}
        </Box>
      )}
    </Box>
  );
}
