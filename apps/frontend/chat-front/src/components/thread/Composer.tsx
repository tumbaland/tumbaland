import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import useMediaQuery from '@mui/material/useMediaQuery';
import SendIcon from '@mui/icons-material/Send';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import SentimentSatisfiedAltIcon from '@mui/icons-material/SentimentSatisfiedAlt';
import { PHONE, TOUCH_TARGET, brand, ink, surface } from '@tumbaland/frontend-core';
import { DOCUMENT_ACCEPT, isDocumentType } from '../../services/documents';
import { FullEmojiPicker, loadEmojiPicker } from './FullEmojiPicker';
import { UploadTray } from './UploadTray';
import { AlbumDestination } from './AlbumDestination';
import { emojiIn, recordEmoji, useRecentEmoji } from './recentEmoji';
import { EFFECTS } from './effects';
import type { MessageEffect, PendingUpload, PhotoAlbum, SendOptions } from '../../types';

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
  /** A sent message being edited. The box holds its text until saved or cancelled. */
  editing?: { id: string; body: string; hasMedia: boolean } | null;
  onSaveEdit?: (body: string) => void;
  onCancelEdit?: () => void;
  /** Where the conversation's photos go. Absent where saving to Album is not offered. */
  photoAlbum?: PhotoAlbum;
  onChooseAlbum?: () => void;
  onAlbumOff?: () => void;
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

/** How long Send must be held before it offers effects instead of sending. */
const HOLD_MS = 450;

export function Composer({
  onSend,
  onTyping,
  disabled,
  uploads = [],
  onAddFiles,
  onRemoveUpload,
  uploading,
  editing,
  onSaveEdit,
  onCancelEdit,
  photoAlbum,
  onChooseAlbum,
  onAlbumOff,
  accent = brand.pinkInk,
  prefill
}: ComposerProps) {
  /** "Not this one", for the photos on the tray now. Cleared after each send. */
  const [skipAlbum, setSkipAlbum] = useState(false);
  const [value, setValue] = useState('');
  /** What was being typed before an edit took the box over, given back after. */
  const draft = useRef('');
  const wasEditing = useRef(false);
  const [emojiAnchor, setEmojiAnchor] = useState<HTMLElement | null>(null);
  const [effectAnchor, setEffectAnchor] = useState<HTMLElement | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Set once a hold has opened the menu, so letting go does not also send. */
  const held = useRef(false);
  const [focused, setFocused] = useState(false);
  const recentEmoji = useRecentEmoji();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const documentRef = useRef<HTMLInputElement | null>(null);

  // On a phone Enter inserts a newline and the button sends; on a desktop
  // keyboard Enter sends and Shift+Enter breaks the line. Getting this the
  // wrong way round on a phone means every message sends half-written.
  const isPhone = useMediaQuery('(hover: none)');

  const editingId = editing?.id;
  useEffect(() => {
    if (editingId) {
      if (!wasEditing.current) draft.current = value;
      wasEditing.current = true;
      setValue(editing?.body ?? '');
      inputRef.current?.focus();
    } else if (wasEditing.current) {
      wasEditing.current = false;
      setValue(draft.current);
      draft.current = '';
    }
    // Keyed on the id alone: a live update to the message's text must not
    // overwrite what is being typed over it.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  useEffect(() => {
    if (!prefill?.text || wasEditing.current) return;
    setValue(prefill.text);
    inputRef.current?.focus();
  }, [prefill]);

  const ready = uploads.filter((upload) => upload.status === 'done').length;
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
    const options: SendOptions = { ...(ready > 0 ? { skipAlbum } : {}), ...(effect ? { effect } : {}) };
    if (Object.keys(options).length > 0) onSend(body, options);
    else onSend(body);
    // Emoji typed from the phone's own keyboard count as used too.
    recordEmoji(...emojiIn(body).reverse());
    setSkipAlbum(false);
    setValue('');
    // Kept focused, so a conversation does not need a tap between each line.
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Escape' && editing) {
      event.preventDefault();
      onCancelEdit?.();
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

  const cancelHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  /**
   * Holding Send, or right-clicking it, offers to send with an effect. It is
   * the gesture other chat apps use for the same thing, and it keeps a plain
   * tap a plain send.
   */
  const startHold = (event: React.PointerEvent<HTMLElement>) => {
    held.current = false;
    if (!offerEffects || event.button !== 0) return;
    const anchor = event.currentTarget;
    holdTimer.current = setTimeout(() => {
      held.current = true;
      setEffectAnchor(anchor);
    }, HOLD_MS);
  };

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
      {editing && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 2, pr: 1, pt: 0.5 }}>
          <EditOutlinedIcon sx={{ fontSize: 18, color: accent }} />
          <Typography variant="caption" sx={{ flex: 1, color: ink.muted, fontWeight: 600 }}>
            Editing message
          </Typography>
          <IconButton size="small" aria-label="Cancel edit" onClick={onCancelEdit} sx={{ color: ink.muted }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      {/* Documents never go to the album, so the choice is only offered for photos and videos. */}
      {!editing &&
        uploads.some((upload) => !isDocumentType(upload.mimetype)) &&
        photoAlbum &&
        onChooseAlbum &&
        onAlbumOff && (
          <AlbumDestination
            photoAlbum={photoAlbum}
            skip={skipAlbum}
            onToggleSkip={() => setSkipAlbum((skip) => !skip)}
            onChoose={onChooseAlbum}
            onTurnOff={onAlbumOff}
          />
        )}

      {!editing && uploads.length > 0 && onRemoveUpload && <UploadTray uploads={uploads} onRemove={onRemoveUpload} />}

      {/* On a phone, while writing only: a thread being read keeps its height,
          and the keyboard opening already reshapes the screen. On a desktop
          it stays put, because appearing on focus and going on blur resized
          the message list and made the whole thread jump each time. */}
      {(!isPhone || focused || value.length > 0) && !disabled && (
        <Box
          role="group"
          aria-label="Recent emoji"
          sx={{
            display: 'flex',
            gap: 0.25,
            px: 1,
            pt: 0.5,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' }
          }}
        >
          {recentEmoji.map((emoji) => (
            <Box
              key={emoji}
              component="button"
              type="button"
              aria-label={`Add ${emoji}`}
              // Keeps the focus, and on a phone the keyboard, in the message box.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => insertEmoji(emoji)}
              tabIndex={-1}
              sx={{
                flexShrink: 0,
                width: 36,
                height: 36,
                border: 'none',
                borderRadius: '50%',
                background: 'none',
                cursor: 'pointer',
                fontSize: 22,
                lineHeight: 1,
                p: 0,
                transition: 'transform .12s ease, background-color .12s ease',
                '&:hover': { backgroundColor: surface.sunken, transform: 'scale(1.12)' },
                '&:active': { transform: 'scale(0.92)' }
              }}
            >
              {emoji}
            </Box>
          ))}
        </Box>
      )}

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

        <IconButton
          type="submit"
          aria-label={editing ? 'Save edit' : 'Send'}
          aria-haspopup={offerEffects ? 'menu' : undefined}
          disabled={!canSend}
          onPointerDown={startHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          onContextMenu={(event) => {
            if (!offerEffects) return;
            event.preventDefault();
            cancelHold();
            setEffectAnchor(event.currentTarget);
          }}
          onClick={(event) => {
            // The press that opened the menu ends in a click; it chose nothing yet.
            if (held.current) {
              event.preventDefault();
              held.current = false;
            }
          }}
          sx={{
            width: TOUCH_TARGET,
            height: TOUCH_TARGET,
            // A long press on a phone would otherwise select or preview the button.
            WebkitTouchCallout: 'none',
            userSelect: 'none',
            color: '#fff',
            bgcolor: accent,
            '&:hover': { bgcolor: accent, filter: 'brightness(0.94)' },
            '&.Mui-disabled': { bgcolor: surface.sunken, color: ink.muted }
          }}
        >
          {editing ? <CheckIcon fontSize="small" /> : <SendIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* The full picker here rather than the six quick reactions: writing a
          message is where someone reaches for a specific emoji, while
          reacting is where the common few are almost always enough. */}
      <Menu
        anchorEl={effectAnchor}
        open={Boolean(effectAnchor)}
        onClose={() => setEffectAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        // Sending puts the focus back in the message box; handing it to the
        // Send button on close would take it away again.
        disableRestoreFocus
      >
        {EFFECTS.map((effect) => (
          <MenuItem
            key={effect.id}
            onClick={() => {
              setEffectAnchor(null);
              submit(effect.id);
            }}
          >
            <Box component="span" aria-hidden sx={{ fontSize: 20, mr: 1.5, lineHeight: 1 }}>
              {effect.emoji}
            </Box>
            {effect.label}
          </MenuItem>
        ))}
      </Menu>

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
