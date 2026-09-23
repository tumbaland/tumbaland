import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import useMediaQuery from '@mui/material/useMediaQuery';
import SendIcon from '@mui/icons-material/Send';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import SentimentSatisfiedAltIcon from '@mui/icons-material/SentimentSatisfiedAlt';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { TOUCH_TARGET, brand, ink, surface } from '@tumbaland/frontend-core';
import { FullEmojiPicker, loadEmojiPicker } from './FullEmojiPicker';
import { UploadTray } from './UploadTray';
import { AlbumDestination } from './AlbumDestination';
import { emojiIn, recordEmoji, useRecentEmoji } from './recentEmoji';
import type { PendingUpload, PhotoAlbum } from '../../types';

export interface ComposerProps {
  /** Options only when photos go with it: whether to leave them out of the album. */
  onSend: (body: string, options?: { skipAlbum: boolean }) => void;
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
}

/**
 * What the picker offers.
 *
 * On both iOS and Android this opens the photo library, recent files and the
 * camera, which covers most of what "easy to share from a phone" means. The
 * system share sheet in the other direction (sharing *into* the app) needs a
 * service worker and is Phase 8.
 */
const ACCEPTED = 'image/*,video/*';

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
  accent = brand.pinkInk
}: ComposerProps) {
  /** "Not this one", for the photos on the tray now. Cleared after each send. */
  const [skipAlbum, setSkipAlbum] = useState(false);
  const [value, setValue] = useState('');
  /** What was being typed before an edit took the box over, given back after. */
  const draft = useRef('');
  const wasEditing = useRef(false);
  const [emojiAnchor, setEmojiAnchor] = useState<HTMLElement | null>(null);
  // Photo and emoji sit behind an arrow, so the message box gets the width on
  // a phone. Most lines are just text.
  const [toolsOpen, setToolsOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const recentEmoji = useRecentEmoji();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

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
      setToolsOpen(false);
      inputRef.current?.focus();
    } else if (wasEditing.current) {
      wasEditing.current = false;
      setValue(draft.current);
      draft.current = '';
    }
    // Keyed on the id alone: a live update to the message's text must not
    // overwrite what is being typed over it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  const ready = uploads.filter((upload) => upload.status === 'done').length;
  // A message may be attachments alone, but never an attachment still in
  // flight: its bytes might not be there when the other person opens it.
  // An edit can only empty the text of a message that has a photo to keep.
  const canSend = editing
    ? Boolean(value.trim() || editing.hasMedia) && !disabled
    : Boolean(value.trim() || ready > 0) && !disabled && !uploading;

  const submit = () => {
    const body = value.trim();
    if (!canSend) return;
    if (editing) {
      // Saving an unchanged message would only stamp it "edited".
      if (body === editing.body.trim()) onCancelEdit?.();
      else onSaveEdit?.(body);
      return;
    }
    if (ready > 0) onSend(body, { skipAlbum });
    else onSend(body);
    // Emoji typed from the phone's own keyboard count as used too.
    recordEmoji(...emojiIn(body).reverse());
    setSkipAlbum(false);
    setValue('');
    setToolsOpen(false);
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

      {!editing && uploads.length > 0 && photoAlbum && onChooseAlbum && onAlbumOff && (
        <AlbumDestination
          photoAlbum={photoAlbum}
          skip={skipAlbum}
          onToggleSkip={() => setSkipAlbum((skip) => !skip)}
          onChoose={onChooseAlbum}
          onTurnOff={onAlbumOff}
        />
      )}

      {!editing && uploads.length > 0 && onRemoveUpload && (
        <UploadTray uploads={uploads} onRemove={onRemoveUpload} />
      )}

      {/* While writing only: a thread being read keeps its height. */}
      {(focused || value.length > 0) && !disabled && (
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
      {!editing && (
      <IconButton
        aria-label={toolsOpen ? 'Hide photo and emoji' : 'Show photo and emoji'}
        aria-expanded={toolsOpen}
        onClick={() => setToolsOpen((open) => !open)}
        // Warms the picker's download while the finger is on the way to it.
        onPointerEnter={() => void loadEmojiPicker().catch(() => {})}
        sx={{ color: ink.muted, width: TOUCH_TARGET, height: TOUCH_TARGET }}
      >
        <ChevronRightIcon
          sx={{ transition: 'transform .2s ease', transform: toolsOpen ? 'rotate(180deg)' : 'none' }}
        />
      </IconButton>
      )}

      {toolsOpen && (
        <>
          {/* One button. On a phone the system picker already offers the
              camera beside the library, so a separate camera button was the
              same thing twice. */}
          {onAddFiles && (
            <IconButton
              aria-label="Add photo or video"
              onClick={() => fileRef.current?.click()}
              sx={{ color: ink.muted, width: TOUCH_TARGET, height: TOUCH_TARGET }}
            >
              <AddPhotoAlternateOutlinedIcon />
            </IconButton>
          )}

          <IconButton
            aria-label="Add emoji"
            onPointerEnter={() => void loadEmojiPicker().catch(() => {})}
            onFocus={() => void loadEmojiPicker().catch(() => {})}
            onClick={(event) => setEmojiAnchor(event.currentTarget)}
            sx={{ color: ink.muted, width: TOUCH_TARGET, height: TOUCH_TARGET }}
          >
            <SentimentSatisfiedAltIcon />
          </IconButton>
        </>
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
        disabled={!canSend}
        sx={{
          width: TOUCH_TARGET,
          height: TOUCH_TARGET,
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
      <FullEmojiPicker anchorEl={emojiAnchor} onClose={() => setEmojiAnchor(null)} onPick={insertEmoji} />

      <input ref={fileRef} type="file" accept={ACCEPTED} multiple hidden onChange={pick} data-testid="file-input" />
    </Box>
  );
}
