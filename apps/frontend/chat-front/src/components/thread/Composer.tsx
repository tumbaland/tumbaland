import { useRef, useState, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import useMediaQuery from '@mui/material/useMediaQuery';
import SendIcon from '@mui/icons-material/Send';
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import SentimentSatisfiedAltIcon from '@mui/icons-material/SentimentSatisfiedAlt';
import { TOUCH_TARGET, brand, ink, surface } from '@tumbaland/frontend-core';
import { FullEmojiPicker } from './FullEmojiPicker';
import { UploadTray } from './UploadTray';
import type { PendingUpload } from '../../types';

export interface ComposerProps {
  onSend: (body: string) => void;
  onTyping: () => void;
  disabled?: boolean;
  uploads?: PendingUpload[];
  /** Absent in a composer with attachments turned off. */
  onAddFiles?: (files: FileList | File[]) => void;
  onRemoveUpload?: (id: string) => void;
  /** True while something is still uploading; sending waits for it. */
  uploading?: boolean;
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
  uploading
}: ComposerProps) {
  const [value, setValue] = useState('');
  const [emojiAnchor, setEmojiAnchor] = useState<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);

  // On a phone Enter inserts a newline and the button sends; on a desktop
  // keyboard Enter sends and Shift+Enter breaks the line. Getting this the
  // wrong way round on a phone means every message sends half-written.
  const isPhone = useMediaQuery('(hover: none)');

  const ready = uploads.filter((upload) => upload.status === 'done').length;
  // A message may be attachments alone, but never an attachment still in
  // flight: its bytes might not be there when the other person opens it.
  const canSend = Boolean(value.trim() || ready > 0) && !disabled && !uploading;

  const submit = () => {
    const body = value.trim();
    if (!canSend) return;
    onSend(body);
    setValue('');
    // Kept focused, so a conversation does not need a tap between each line.
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

  const insertEmoji = (emoji: string) => {
    setValue((previous) => previous + emoji);
    inputRef.current?.focus();
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
      {uploads.length > 0 && onRemoveUpload && <UploadTray uploads={uploads} onRemove={onRemoveUpload} />}

      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5, p: 1 }}>
      {onAddFiles && (
        <>
          <IconButton
            aria-label="Add photo or video"
            onClick={() => fileRef.current?.click()}
            sx={{ color: ink.muted, width: TOUCH_TARGET, height: TOUCH_TARGET }}
          >
            <AddPhotoAlternateOutlinedIcon />
          </IconButton>
          <IconButton
            aria-label="Take a photo"
            onClick={() => cameraRef.current?.click()}
            sx={{ color: ink.muted, width: TOUCH_TARGET, height: TOUCH_TARGET, display: { xs: 'inline-flex', sm: 'none' } }}
          >
            <PhotoCameraOutlinedIcon />
          </IconButton>
        </>
      )}

      <IconButton
        aria-label="Add emoji"
        onClick={(event) => setEmojiAnchor(event.currentTarget)}
        sx={{ color: ink.muted, width: TOUCH_TARGET, height: TOUCH_TARGET }}
      >
        <SentimentSatisfiedAltIcon />
      </IconButton>

      <InputBase
        inputRef={inputRef}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          onTyping();
        }}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        placeholder="Message"
        multiline
        maxRows={6}
        disabled={disabled}
        inputProps={{ 'aria-label': 'Message' }}
        sx={{
          flex: 1,
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
        aria-label="Send"
        disabled={!canSend}
        sx={{
          width: TOUCH_TARGET,
          height: TOUCH_TARGET,
          color: '#fff',
          bgcolor: brand.pinkInk,
          '&:hover': { bgcolor: brand.pinkInk, filter: 'brightness(0.94)' },
          '&.Mui-disabled': { bgcolor: surface.sunken, color: ink.muted }
        }}
      >
        <SendIcon fontSize="small" />
      </IconButton>

      </Box>

      {/* The full picker here rather than the six quick reactions: writing a
          message is where someone reaches for a specific emoji, while
          reacting is where the common few are almost always enough. */}
      <FullEmojiPicker anchorEl={emojiAnchor} onClose={() => setEmojiAnchor(null)} onPick={insertEmoji} />

      {/* Two inputs, not one: `capture` on the shared picker would take every
          selection straight to the camera and hide the photo library. */}
      <input ref={fileRef} type="file" accept={ACCEPTED} multiple hidden onChange={pick} data-testid="file-input" />
      <input
        ref={cameraRef}
        type="file"
        accept={ACCEPTED}
        capture="environment"
        hidden
        onChange={pick}
        data-testid="camera-input"
      />
    </Box>
  );
}
