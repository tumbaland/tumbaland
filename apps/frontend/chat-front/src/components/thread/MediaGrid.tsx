import { useState } from 'react';
import Box from '@mui/material/Box';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import BrokenImageOutlinedIcon from '@mui/icons-material/BrokenImageOutlined';
import { ink, surface } from '@tumbaland/frontend-core';
import type { Attachment } from '../../types';

export interface MediaGridProps {
  attachments: Attachment[];
  onOpen: (index: number) => void;
}

export const isVideo = (attachment: Attachment) => attachment.mimetype?.startsWith('video/') ?? false;

/** What to show in the grid: the small copy where there is one. */
export function previewSrc(attachment: Attachment): string | null {
  if (isVideo(attachment)) return attachment.posterUrl ?? null;
  return attachment.thumbnailUrl ?? attachment.url ?? null;
}

/**
 * Columns for a set of attachments.
 *
 * One fills the bubble, two sit side by side, and three or more go into a
 * square grid. Fixed rather than computed from the images' own aspect ratios:
 * the ratios only arrive once each image loads, so laying out from them makes
 * the thread jump as they arrive.
 */
export function columnsFor(count: number): number {
  if (count <= 1) return 1;
  if (count === 2) return 2;
  return 3;
}

/** A duration, for the corner of a video tile. */
export function formatDuration(ms?: number | null): string | null {
  if (!ms || ms <= 0) return null;
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function MediaGrid({ attachments, onOpen }: MediaGridProps) {
  const columns = columnsFor(attachments.length);

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 0.5,
        mb: 0.5,
        borderRadius: 2,
        overflow: 'hidden',
        // A single image keeps its shape; a grid squares its tiles so the rows
        // line up whatever the originals were.
        width: attachments.length === 1 ? 'min(280px, 100%)' : 'min(320px, 100%)'
      }}
    >
      {attachments.map((attachment, index) => (
        <MediaTile
          key={attachment.fileId}
          attachment={attachment}
          square={attachments.length > 1}
          onOpen={() => onOpen(index)}
        />
      ))}
    </Box>
  );
}

interface MediaTileProps {
  attachment: Attachment;
  square: boolean;
  onOpen: () => void;
}

function MediaTile({ attachment, square, onOpen }: MediaTileProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = previewSrc(attachment);
  const video = isVideo(attachment);
  const duration = formatDuration(attachment.durationMs);

  // A signed URL expires, and file-service may be unreachable. Either way the
  // tile says so rather than showing a browser's broken-image glyph.
  const unavailable = !src || failedSrc === src;

  return (
    <Box
      component="button"
      type="button"
      onClick={onOpen}
      aria-label={video ? 'Open video' : 'Open photo'}
      sx={{
        position: 'relative',
        p: 0,
        border: 'none',
        cursor: 'pointer',
        display: 'block',
        width: '100%',
        aspectRatio: square ? '1 / 1' : undefined,
        minHeight: square ? undefined : 120,
        // A tall portrait photo is cropped to this in the thread; the whole
        // picture is one tap away in the lightbox.
        maxHeight: square ? undefined : 360,
        bgcolor: surface.sunken,
        overflow: 'hidden'
      }}
    >
      {unavailable ? (
        <Box sx={{ display: 'grid', placeItems: 'center', height: '100%', minHeight: 120, color: ink.muted }}>
          <BrokenImageOutlinedIcon />
        </Box>
      ) : (
        <Box
          component="img"
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailedSrc(src)}
          sx={{ display: 'block', width: '100%', height: '100%', maxHeight: square ? undefined : 360, objectFit: 'cover' }}
        />
      )}

      {video && !unavailable && (
        <>
          <PlayCircleIcon
            sx={{
              position: 'absolute',
              inset: 0,
              m: 'auto',
              fontSize: 44,
              color: 'rgba(255,255,255,0.92)',
              filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))'
            }}
          />
          {duration && (
            <Box
              sx={{
                position: 'absolute',
                right: 6,
                bottom: 6,
                px: 0.75,
                borderRadius: 1,
                bgcolor: 'rgba(0,0,0,0.6)',
                color: '#fff',
                fontSize: 11,
                lineHeight: 1.6
              }}
            >
              {duration}
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
