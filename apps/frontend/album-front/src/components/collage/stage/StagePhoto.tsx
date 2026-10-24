import React, { CSSProperties } from 'react';
import { Box } from '@mui/material';
import BrokenImageIcon from '@mui/icons-material/BrokenImage';
import {
  CollageCrop,
  CollageDoc,
  CollagePhotoItem,
  isQuarterTurned,
  isVideoType,
  orientationTurns,
  photoHasFrame,
  sourceCrop,
  wholePhotoBlur
} from '@tumbaland/collage-core';
import type { ResolvedPhoto } from './types';
import { FOLLOW_TRANSITION } from '../CollagePeople';

const FRAME_PADDING = 12;

/**
 * Sizes an <img> so that only its crop region shows through the parent's
 * overflow: the image is blown up by 1/crop and shifted so the region's
 * top-left corner sits at the parent's origin.
 */
const cropImageStyle = (crop?: CollageCrop): CSSProperties => {
  if (!crop) return { width: '100%', height: '100%' };
  return {
    position: 'absolute',
    width: `${100 / crop.width}%`,
    height: `${100 / crop.height}%`,
    left: `${(-crop.x / crop.width) * 100}%`,
    top: `${(-crop.y / crop.height) * 100}%`
  };
};

/** The picture's own style: its crop filling the box, or all of it inside the box. */
const pictureStyle = (photo: CollagePhotoItem): CSSProperties =>
  photo.fit === 'contain'
    ? { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'contain' }
    : { ...cropImageStyle(sourceCrop(photo)), objectFit: 'cover' };

/**
 * Behind a whole photo, a blurred copy of it filling the box, as the export
 * draws it. Scaled up a little so the blur does not fade in from the edges.
 */
const WholePhotoBackdrop: React.FC<{ src?: string; content: { width: number; height: number } }> = ({ src, content }) =>
  src ? (
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        filter: `blur(${wholePhotoBlur(content.width, content.height)}px)`,
        transform: 'scale(1.1)',
        display: 'block',
        pointerEvents: 'none'
      }}
    />
  ) : null;

/**
 * Box the image is drawn into before its quarter turns are applied. Turning it
 * by 90 or 270 swaps the axes, so the pre-turn box is the content box on its
 * side; rotating that lands it back exactly on the content box.
 */
const orientedLayer = (content: { width: number; height: number }, orientation?: number): CSSProperties => {
  const turned = isQuarterTurned(orientation);
  const width = turned ? content.height : content.width;
  const height = turned ? content.width : content.height;
  return {
    position: 'absolute',
    width,
    height,
    left: (content.width - width) / 2,
    top: (content.height - height) / 2,
    overflow: 'hidden',
    transform: `rotate(${orientationTurns(orientation) * 90}deg)`
  };
};

export const StagePhoto: React.FC<{
  doc: CollageDoc;
  photo: CollagePhotoItem;
  resolved?: ResolvedPhoto;
  selected: boolean;
  readOnly: boolean;
  /** Someone else is moving it: ease between their reported positions. */
  followed?: boolean;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onDoubleClick?: () => void;
}> = ({ doc, photo, resolved, selected, readOnly, followed, onPointerDown, onDoubleClick }) => {
  const framed = photoHasFrame(doc, photo);
  const src = resolved?.src || resolved?.thumbSrc;
  const inset = framed ? FRAME_PADDING * 2 : 0;
  const content = { width: photo.width - inset, height: photo.height - inset };
  return (
    <Box
      data-item-id={photo.id}
      sx={{
        position: 'absolute',
        left: photo.x,
        top: photo.y,
        width: photo.width,
        height: photo.height,
        transform: `rotate(${photo.rotation || 0}deg)`,
        bgcolor: framed ? doc.frameColor : 'transparent',
        p: framed ? `${FRAME_PADDING}px` : 0,
        boxShadow: framed ? '0 4px 10px rgba(0,0,0,0.25)' : 'none',
        borderRadius: '4px',
        cursor: readOnly ? 'default' : 'grab',
        userSelect: 'none',
        touchAction: 'none',
        outline: selected ? '2px solid #6366f1' : 'none',
        outlineOffset: '2px',
        transition: followed ? FOLLOW_TRANSITION : undefined
      }}
      onPointerDown={readOnly ? undefined : (e) => onPointerDown(e, photo.id)}
      onDoubleClick={readOnly ? undefined : onDoubleClick}
    >
      <Box sx={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: '4px' }}>
        {isVideoType(resolved?.mimetype) && resolved?.src ? (
          <Box sx={orientedLayer(content, photo.orientation)}>
            {photo.fit === 'contain' && <WholePhotoBackdrop src={resolved.posterSrc} content={content} />}
            {/* Plays silently on a loop, as it would in a moving collage. */}
            <video
              src={resolved.src}
              poster={resolved.posterSrc}
              aria-label={resolved?.title || 'collage video'}
              muted
              loop
              autoPlay
              playsInline
              style={{
                ...pictureStyle(photo),
                display: 'block',
                pointerEvents: 'none'
              }}
            />
          </Box>
        ) : src ? (
          <Box sx={orientedLayer(content, photo.orientation)}>
            {photo.fit === 'contain' && <WholePhotoBackdrop src={src} content={content} />}
            <img
              src={src}
              alt={resolved?.title || 'collage photo'}
              draggable={false}
              style={{
                ...pictureStyle(photo),
                display: 'block',
                pointerEvents: 'none'
              }}
            />
          </Box>
        ) : (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              bgcolor: 'rgba(128,128,128,0.25)',
              color: 'rgba(255,255,255,0.7)',
              borderRadius: 1,
              fontSize: '0.8rem'
            }}
          >
            <BrokenImageIcon fontSize="small" />
            Image unavailable
          </Box>
        )}
        {photo.caption && (
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              bgcolor: 'rgba(255,255,255,0.92)',
              color: '#111',
              px: 1,
              py: 0.5,
              fontSize: '0.9rem',
              textAlign: 'center',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              borderBottomLeftRadius: 4,
              borderBottomRightRadius: 4,
              pointerEvents: 'none'
            }}
          >
            {photo.caption}
          </Box>
        )}
      </Box>
    </Box>
  );
};
