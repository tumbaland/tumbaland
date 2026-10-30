import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import useMediaQuery from '@mui/material/useMediaQuery';
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import SentimentSatisfiedAltIcon from '@mui/icons-material/SentimentSatisfiedAlt';
import { PHONE, TOUCH_TARGET, brand, ink, surface } from '@tumbaland/frontend-core';
import { DOCUMENT_ACCEPT, isDocumentType } from '../../services/documents';
import { FullEmojiPicker, loadEmojiPicker } from './FullEmojiPicker';
import { UploadTray } from './UploadTray';
import { VoiceRow } from './VoiceRow';
import { EditingBanner, RecentEmojiRow, ReplyingBanner } from './ComposerBars';
import { AlbumDestination } from './AlbumDestination';
import { emojiIn, recordEmoji, useRecentEmoji } from './recentEmoji';
import { useComposerText } from '../../hooks/useComposerText';
import { SendButton } from './SendButton';
import type { VoiceMessage } from '../../hooks/useVoiceMessage';
import { isVisualType } from '../../services/voice';
import { MentionSuggestions } from './MentionSuggestions';
import { insertMention, mentionSuggestions } from './mentionSuggest';
import type { Bot, MessageEffect, PendingUpload, PhotoAlbum, SendOptions } from '../../types';

export interface ComposerProps {
  /**
   * Options only when there are any: whether photos going with it stay out of
   * the album, and the effect it was sent with.
   */
  onSend: (body: string, options?: SendOptions) => void;
  onTyping: () => void;
  disabled?: boolean;
  uploads?: PendingUpload[];
  /** Absent in a composer with attachments turned off. */
  onAddFiles?: (files: FileList | File[]) => void;
  onRemoveUpload?: (id: string) => void;
  /** True while something is still uploading; sending waits for it. */
  uploading?: boolean;
  /**
   * The thread's voice message. Its mic is on the header; while it is recording,
   * sending or held, its controls take this row over.
   */
  voice?: VoiceMessage;
  /** A sent message being edited. The box holds its text until saved or cancelled. */
  editing?: { id: string; body: string; hasMedia: boolean } | null;
  onSaveEdit?: (body: string) => void;
  onCancelEdit?: () => void;
  /** The message the next send answers, shown above the box until sent or cancelled. */
  replying?: { id: string; name: string; text: string } | null;
  onCancelReply?: () => void;
  /** Where the conversation's photos go. Absent where saving to Album is not offered. */
  photoAlbum?: PhotoAlbum;
  onChooseAlbum?: () => void;
  onAlbumOff?: () => void;
  /** The assistants in this chat, offered as `@` suggestions while someone types a mention. */
  bots?: Bot[];
  /** The send button's colour, from the conversation's theme. */
  accent?: string;
  /**
   * Text put in the box for the person to send or change: a link shared from
   * another app. Applied once per `key`, so the same link shared twice fills
   * the box twice; never while an edit has the box.
   */
  prefill?: { text: string; key: number } | null;
}

/**
 * What the picker offers.
 *
 * On both iOS and Android this opens the photo library, recent files and the
 * camera. The other direction, sharing into the app from the phone's share
 * menu, arrives through the shell's /share page and `prefill`.
 */
const ACCEPTED = 'image/*,video/*';

/**
 * Documents get a button of their own. Adding them to the photo picker would
 * turn the phone's photo library into a file browser, and a person reaching for
 * a picture would have to find it there.
 */
const ACCEPTED_DOCUMENTS = DOCUMENT_ACCEPT;


export function Composer({
  onSend,
  onTyping,
  disabled,
  uploads = [],
  onAddFiles,
  onRemoveUpload,
  uploading,
  voice,
  editing,
  onSaveEdit,
  onCancelEdit,
  replying,
  onCancelReply,
  photoAlbum,
  onChooseAlbum,
  onAlbumOff,
  bots,
  accent = brand.pinkInk,
  prefill
}: ComposerProps) {
  /** Photos on the tray kept out of the album, by upload id. Cleared after each send. */
  const [albumSkips, setAlbumSkips] = useState<ReadonlySet<string>>(() => new Set());
  const [emojiAnchor, setEmojiAnchor] = useState<HTMLElement | null>(null);
  const [focused, setFocused] = useState(false);
  const recentEmoji = useRecentEmoji();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { value, setValue } = useComposerText({ editing, prefill, inputRef });
  const fileRef = useRef<HTMLInputElement | null>(null);
  const documentRef = useRef<HTMLInputElement | null>(null);

  // On a phone Enter inserts a newline and the button sends; on a desktop
  // keyboard Enter sends and Shift+Enter breaks the line. Getting this the
  // wrong way round on a phone means every message sends half-written.
  const isPhone = useMediaQuery('(hover: none)');

  // Choosing Reply puts the cursor in the box, ready for the answer.
  const replyingId = replying?.id;
  useEffect(() => {
    if (replyingId) inputRef.current?.focus();
  }, [replyingId]);

  const ready = uploads.filter((upload) => upload.status === 'done').length;
  const mediaUploads = uploads.filter((upload) => isVisualType(upload.mimetype));
  const goingToAlbum = mediaUploads.filter((upload) => !albumSkips.has(upload.id)).length;
  const toggleAlbumSkip = (id: string) =>
    setAlbumSkips((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // A message may be attachments alone, but never an attachment still in
  // flight: its bytes might not be there when the other person opens it.
  // An edit can only empty the text of a message that has a photo to keep.
  const canSend = editing
    ? Boolean(value.trim() || editing.hasMedia) && !disabled
    : Boolean(value.trim() || ready > 0) && !disabled && !uploading;

  const submit = (effect?: MessageEffect) => {
    const body = value.trim();
    if (!canSend) return;
    if (editing) {
      // Saving an unchanged message would only stamp it "edited".
      if (body === editing.body.trim()) onCancelEdit?.();
      else onSaveEdit?.(body);
      return;
    }
    // All of them left out is the plain "not this one"; some, and only those stay out.
    const readyMedia = uploads.filter(
      (upload) => upload.status === 'done' && upload.attachment && isVisualType(upload.mimetype)
    );
    const skipped = readyMedia.filter((upload) => albumSkips.has(upload.id)).map((upload) => upload.attachment!.fileId);
    const skipAlbum = readyMedia.length > 0 && skipped.length === readyMedia.length;
    const options: SendOptions = {
      ...(ready > 0 ? { skipAlbum } : {}),
      ...(skipped.length > 0 && !skipAlbum ? { skipAlbumFileIds: skipped } : {}),
      ...(effect ? { effect } : {})
    };
    if (Object.keys(options).length > 0) onSend(body, options);
    else onSend(body);
    // Emoji typed from the phone's own keyboard count as used too.
    recordEmoji(...emojiIn(body).reverse());
    setAlbumSkips(new Set());
    setValue('');
    // Kept focused, so a conversation does not need a tap between each line.
    inputRef.current?.focus();
  };

  // The `@` list, while one is open: Tab fills in the first, as a tap on it would.
  const suggested = !editing && !disabled && !voice?.active && bots ? mentionSuggestions(value, bots) : [];
  const pickMention = (bot: Bot) => {
    setValue(insertMention(value, bot.name));
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Tab' && !event.shiftKey && suggested[0]) {
      event.preventDefault();
      pickMention(suggested[0]);
      return;
    }
    if (event.key === 'Escape' && editing) {
      event.preventDefault();
      onCancelEdit?.();
      return;
    }
    if (event.key === 'Escape' && replying) {
      event.preventDefault();
      onCancelReply?.();
      return;
    }
    if (event.key !== 'Enter') return;
    if (isPhone || event.shiftKey) return;
    event.preventDefault();
    submit();
  };

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) onAddFiles?.(event.target.files);
    // Cleared so picking the same file twice in a row still fires a change.
    event.target.value = '';
  };

  /** Paste and drag-and-drop, which is how this is used on a desktop. */
  const onPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(event.clipboardData?.files ?? []);
    if (files.length > 0 && onAddFiles) {
      event.preventDefault();
      onAddFiles(files);
    }
  };

  // Effects are for a new message. An edit keeps whatever it was sent with.
  const offerEffects = canSend && !editing;

  const voiceActive = Boolean(voice?.active);

  /**
   * At the cursor, not the end: an emoji added to the middle of a sentence
   * used to land after its last word.
   */
  const insertEmoji = (emoji: string) => {
    const input = inputRef.current;
    const start = input?.selectionStart ?? value.length;
    const end = input?.selectionEnd ?? value.length;
    setValue(value.slice(0, start) + emoji + value.slice(end));
    recordEmoji(emoji);
    if (!editing) onTyping();
    // After React has put the new text in, so the cursor lands behind the emoji.
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  return (
    <Box
      component="form"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      onDrop={(event) => {
        if (!onAddFiles || event.dataTransfer.files.length === 0) return;
        event.preventDefault();
        onAddFiles(event.dataTransfer.files);
      }}
      onDragOver={(event) => onAddFiles && event.preventDefault()}
      sx={{
        borderTop: `1px solid ${surface.sunken}`,
        bgcolor: surface.paper,
        // Clears the home indicator on an installed iOS app.
        pb: 'calc(8px + env(safe-area-inset-bottom))'
      }}
    >
      {editing && <EditingBanner accent={accent} onCancel={onCancelEdit} />}

      {replying && !editing && <ReplyingBanner replying={replying} accent={accent} onCancel={onCancelReply} />}

      {/* Documents never go to the album, so the choice is only offered for photos and videos. */}
      {!editing &&
        uploads.some((upload) => !isDocumentType(upload.mimetype)) &&
        photoAlbum &&
        onChooseAlbum &&
        onAlbumOff && (
          <AlbumDestination
            photoAlbum={photoAlbum}
            skip={mediaUploads.length > 0 && goingToAlbum === 0}
            going={goingToAlbum}
            total={mediaUploads.length}
            onToggleSkip={() =>
              // Some left out, or none: leave them all out. All left out: put them all back.
              setAlbumSkips(goingToAlbum === 0 ? new Set() : new Set(mediaUploads.map((upload) => upload.id)))
            }
            onChoose={onChooseAlbum}
            onTurnOff={onAlbumOff}
          />
        )}

      {!editing && uploads.length > 0 && onRemoveUpload && (
        <UploadTray
          uploads={uploads}
          onRemove={onRemoveUpload}
          album={
            photoAlbum?.mode === 'album'
              ? { name: photoAlbum.albumName ?? 'the album', skipped: albumSkips, onToggle: toggleAlbumSkip }
              : undefined
          }
        />
      )}

      {/* On a phone, while writing only: a thread being read keeps its height,
          and the keyboard opening already reshapes the screen. On a desktop
          it stays put, because appearing on focus and going on blur resized
          the message list and made the whole thread jump each time. */}
      {(!isPhone || focused || value.length > 0) && !disabled && !voiceActive && (
        <RecentEmojiRow emoji={recentEmoji} onPick={insertEmoji} />
      )}

      <MentionSuggestions bots={suggested} onPick={pickMention} />

      {voice?.error && !voiceActive && (
        <Typography variant="caption" role="alert" sx={{ display: 'block', px: 2, pt: 0.5, color: 'error.main' }}>
          {voice.error}
        </Typography>
      )}

      {voice && voiceActive ? (
        <VoiceRow voice={voice} accent={accent} />
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5, p: 1 }}>
          {/* One button. On a phone the system picker already offers the camera
            beside the library, so a separate camera button was the same thing
            twice. */}
          {!editing && onAddFiles && (
            <IconButton
              aria-label="Add photo or video"
              onClick={() => fileRef.current?.click()}
              sx={{ color: ink.muted, width: TOUCH_TARGET, height: TOUCH_TARGET }}
            >
              <AddPhotoAlternateOutlinedIcon />
            </IconButton>
          )}

          {!editing && onAddFiles && (
            <IconButton
              aria-label="Add document"
              onClick={() => documentRef.current?.click()}
              sx={{ color: ink.muted, width: TOUCH_TARGET, height: TOUCH_TARGET, ml: -0.5 }}
            >
              <AttachFileIcon />
            </IconButton>
          )}

          <InputBase
            inputRef={inputRef}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              if (!editing) onTyping();
            }}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Message"
            multiline
            maxRows={6}
            disabled={disabled}
            inputProps={{ 'aria-label': 'Message' }}
            // Inside the box, at its end, so the message gets the row's width and
            // the only thing beside it is the photo button.
            endAdornment={
              <IconButton
                aria-label="Add emoji"
                onPointerEnter={() => void loadEmojiPicker().catch(() => {})}
                onFocus={() => void loadEmojiPicker().catch(() => {})}
                // Keeps the focus, and on a phone the keyboard, in the message box.
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => setEmojiAnchor(event.currentTarget)}
                sx={{
                  // Level with the last line as the box grows, and pulled into
                  // its padding so it does not make a one-line box any taller.
                  alignSelf: 'flex-end',
                  width: 36,
                  height: 36,
                  // The theme gives every icon button a 44px minimum on a phone,
                  // which made the box 52px against the 44px photo and Send
                  // buttons beside it, and left them sitting low. Undone inside
                  // the same query, or the theme's rule wins by coming later.
                  [PHONE]: { minWidth: 36, minHeight: 36 },
                  my: -0.5,
                  mr: -1,
                  ml: 0.5,
                  color: ink.muted,
                  bgcolor: 'transparent'
                }}
              >
                <SentimentSatisfiedAltIcon fontSize="small" />
              </IconButton>
            }
            sx={{
              flex: 1,
              // As tall as the buttons beside it, so one line of text sits level
              // with Send rather than a few pixels below its top. Longer messages
              // still grow upwards from here.
              minHeight: TOUCH_TARGET,
              boxSizing: 'border-box',
              px: 1.5,
              py: 1,
              borderRadius: 3,
              bgcolor: surface.sunken,
              // 16px or larger, or iOS Safari zooms the page on focus and never
              // zooms back out.
              fontSize: 16,
              lineHeight: 1.4
            }}
          />

          <SendButton
            editing={Boolean(editing)}
            disabled={!canSend}
            offerEffects={offerEffects}
            accent={accent}
            onSendWithEffect={submit}
          />
        </Box>
      )}

      {/* The full picker here rather than the six quick reactions: writing a
          message is where someone reaches for a specific emoji, while
          reacting is where the common few are almost always enough. */}
      <FullEmojiPicker anchorEl={emojiAnchor} onClose={() => setEmojiAnchor(null)} onPick={insertEmoji} />

      <input ref={fileRef} type="file" accept={ACCEPTED} multiple hidden onChange={pick} data-testid="file-input" />
      <input
        ref={documentRef}
        type="file"
        accept={ACCEPTED_DOCUMENTS}
        multiple
        hidden
        onChange={pick}
        data-testid="document-input"
      />
    </Box>
  );
}
