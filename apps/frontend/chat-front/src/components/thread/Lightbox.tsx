import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DownloadIcon from '@mui/icons-material/Download';
import IosShareIcon from '@mui/icons-material/IosShare';
import { TOUCH_TARGET } from '@tumbaland/frontend-core';
import type { Attachment } from '../../types';
import { isVideo } from './MediaGrid';

export interface LightboxProps {
  attachments: Attachment[];
  /** Null when closed. */
  index: number | null;
  onClose: () => void;
}

/**
 * Whether this browser can hand a file to the system share sheet.
 *
 * Feature-detected with the actual file rather than assumed: `navigator.share`
 * exists on desktop Chrome but refuses files, so checking only for the method
 * would show a button that always fails.
 */
export function canShareFile(file: File): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
}

export function Lightbox({ attachments, index, onClose }: LightboxProps) {
  const [current, setCurrent] = useState(index ?? 0);
  // Reset while rendering rather than in an effect, so reopening on another
  // message never draws one frame of whatever slide was open last time.
  const [openedAt, setOpenedAt] = useState(index);
  if (index !== openedAt) {
    setOpenedAt(index);
    if (index !== null) setCurrent(index);
  }

  const attachment = attachments[current];

  // Whether the share sheet takes files depends on the type, not the bytes,
  // so an empty file of the same type answers it. Fetching the real one to
  // ask meant downloading a whole video a second time just to draw a button.
  const sharable =
    Boolean(attachment?.url) && canShareFile(new File([], 'tumbaland', { type: attachment?.mimetype ?? '' }));

  useEffect(() => {
    if (index === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') setCurrent((value) => Math.max(0, value - 1));
      if (event.key === 'ArrowRight') setCurrent((value) => Math.min(attachments.length - 1, value + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, attachments.length]);

  const share = async () => {
    if (!attachment?.url) return;
    try {
      const blob = await (await fetch(attachment.url)).blob();
      const extension = blob.type.split('/')[1] ?? 'bin';
      const file = new File([blob], `tumbaland.${extension}`, { type: blob.type });
      if (canShareFile(file)) await navigator.share({ files: [file] });
    } catch {
      // A cancelled share sheet throws too; there is nothing to report.
    }
  };

  if (index === null || !attachment) return null;

  return (
    <Dialog
      open
      onClose={onClose}
      fullScreen
      slotProps={{ paper: { sx: { bgcolor: 'rgba(0,0,0,0.94)' } } }}
      aria-label="Attachment"
    >
      <Box sx={{ position: 'absolute', top: 'env(safe-area-inset-top)', right: 0, zIndex: 2, display: 'flex' }}>
        {sharable && (
          <IconButton onClick={share} aria-label="Share" sx={{ color: '#fff', width: TOUCH_TARGET, height: TOUCH_TARGET }}>
            <IosShareIcon />
          </IconButton>
        )}
        {attachment.url && (
          <IconButton
            component="a"
            href={attachment.url}
            download
            aria-label="Download"
            sx={{ color: '#fff', width: TOUCH_TARGET, height: TOUCH_TARGET }}
          >
            <DownloadIcon />
          </IconButton>
        )}
        <IconButton onClick={onClose} aria-label="Close" sx={{ color: '#fff', width: TOUCH_TARGET, height: TOUCH_TARGET }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Flex, not grid: a grid row sizes to its content, so the image's
          max-height resolved against itself and a tall photo ran off the
          bottom of a desktop screen. */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: 0,
          boxSizing: 'border-box',
          overflow: 'hidden',
          p: 2,
          // Clear of the close button above and the arrows either side.
          pt: `calc(${TOUCH_TARGET}px + env(safe-area-inset-top))`,
          px: attachments.length > 1 ? 7 : 2
        }}
      >
        {!attachment.url ? (
          <Box sx={{ color: '#fff' }}>That file is not available right now.</Box>
        ) : isVideo(attachment) ? (
          <Box
            component="video"
            src={attachment.url}
            poster={attachment.posterUrl ?? undefined}
            controls
            autoPlay
            playsInline
            sx={{ display: 'block', maxWidth: '100%', maxHeight: '100%', minHeight: 0 }}
          />
        ) : (
          <Box
            component="img"
            src={attachment.url}
            alt=""
            sx={{ display: 'block', maxWidth: '100%', maxHeight: '100%', minHeight: 0, objectFit: 'contain' }}
          />
        )}
      </Box>

      {attachments.length > 1 && (
        <>
          <IconButton
            onClick={() => setCurrent((value) => Math.max(0, value - 1))}
            disabled={current === 0}
            aria-label="Previous"
            sx={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#fff' }}
          >
            <ChevronLeftIcon fontSize="large" />
          </IconButton>
          <IconButton
            onClick={() => setCurrent((value) => Math.min(attachments.length - 1, value + 1))}
            disabled={current === attachments.length - 1}
            aria-label="Next"
            sx={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#fff' }}
          >
            <ChevronRightIcon fontSize="large" />
          </IconButton>
        </>
      )}
    </Dialog>
  );
}
