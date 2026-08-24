import React, { useRef, useState } from 'react';
import { Box } from '@mui/material';
import { CollageCrop, MIN_CROP_SIZE, isQuarterTurned } from './collageDoc';

interface CollageCropSelectorProps {
  src: string;
  /** item rotation, mirrored onto the preview so the crop box lines up with it */
  rotation: number;
  /** quarter turns baked into the picture; the crop is measured after them */
  orientation?: number;
  crop?: CollageCrop;
  onChange: (crop?: CollageCrop) => void;
  /** reported once the preview loads, so callers can reason about aspect ratio */
  onNaturalSize?: (size: { width: number; height: number }) => void;
}

type GestureMode = 'draw' | 'move' | 'resize';

interface Gesture {
  mode: GestureMode;
  origin: { x: number; y: number };
  /** crop as it was when the gesture started; restored if the gesture is a no-op */
  start?: CollageCrop;
}

/** Box the oriented preview is fitted into. */
const MAX_PREVIEW = { width: 340, height: 220 };

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

const percent = (n: number): string => `${n * 100}%`;

/**
 * Pointer position in the preview's own coordinate space, as fractions of its
 * width and height. The preview carries the item's rotation, so the vector from
 * its centre is rotated back by the same angle before being measured.
 */
const localPoint = (
  el: HTMLElement,
  clientX: number,
  clientY: number,
  rotation: number
): { x: number; y: number } | null => {
  const rect = el.getBoundingClientRect();
  const width = el.offsetWidth || rect.width;
  const height = el.offsetHeight || rect.height;
  if (!width || !height) return null;

  const radians = (-rotation * Math.PI) / 180;
  const dx = clientX - (rect.left + rect.width / 2);
  const dy = clientY - (rect.top + rect.height / 2);
  const x = dx * Math.cos(radians) - dy * Math.sin(radians) + width / 2;
  const y = dx * Math.sin(radians) + dy * Math.cos(radians) + height / 2;

  return { x: clamp(x / width, 0, 1), y: clamp(y / height, 0, 1) };
};

/**
 * Drag-to-select crop overlay drawn on top of a photo preview.
 *
 * Dragging on bare image starts a new selection, dragging inside an existing
 * one moves it, and the corner handle resizes it. Selections smaller than
 * MIN_CROP_SIZE are treated as a stray click and roll back to the previous
 * crop, so a mis-click never silently shrinks the photo to nothing.
 */
const CollageCropSelector: React.FC<CollageCropSelectorProps> = ({
  src,
  rotation,
  orientation,
  crop,
  onChange,
  onNaturalSize
}) => {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);

  const turned = isQuarterTurned(orientation);
  // The preview is laid out at the *oriented* aspect ratio so that the crop
  // overlay, which covers it edge to edge, measures the picture the user sees.
  // Until the image reports its size there is nothing to compute a box from,
  // so the image lays itself out as before and the overlay follows it.
  const oriented = natural && {
    width: turned ? natural.height : natural.width,
    height: turned ? natural.width : natural.height
  };
  const fit =
    oriented && oriented.width > 0 && oriented.height > 0
      ? Math.min(MAX_PREVIEW.width / oriented.width, MAX_PREVIEW.height / oriented.height, 1)
      : null;
  const display = oriented && fit ? { width: oriented.width * fit, height: oriented.height * fit } : null;
  // pre-turn footprint of the image inside that box
  const imageBox = display && {
    width: turned ? display.height : display.width,
    height: turned ? display.width : display.height
  };

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const size = { width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight };
    setNatural(size);
    onNaturalSize?.(size);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const point = localPoint(surface, e.clientX, e.clientY, rotation);
    if (!point) return;

    e.preventDefault();
    const role = (e.target as HTMLElement).dataset.cropRole;
    const mode: GestureMode = role === 'handle' ? 'resize' : role === 'region' ? 'move' : 'draw';
    gestureRef.current = { mode, origin: point, start: crop };
    surface.setPointerCapture?.(e.pointerId);

    if (mode === 'draw') {
      onChange({ x: point.x, y: point.y, width: 0, height: 0 });
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const gesture = gestureRef.current;
    const surface = surfaceRef.current;
    if (!gesture || !surface) return;
    const point = localPoint(surface, e.clientX, e.clientY, rotation);
    if (!point) return;

    if (gesture.mode === 'draw') {
      onChange({
        x: Math.min(gesture.origin.x, point.x),
        y: Math.min(gesture.origin.y, point.y),
        width: Math.abs(point.x - gesture.origin.x),
        height: Math.abs(point.y - gesture.origin.y)
      });
      return;
    }

    const start = gesture.start;
    if (!start) return;

    if (gesture.mode === 'move') {
      onChange({
        ...start,
        x: clamp(start.x + (point.x - gesture.origin.x), 0, 1 - start.width),
        y: clamp(start.y + (point.y - gesture.origin.y), 0, 1 - start.height)
      });
      return;
    }

    onChange({
      ...start,
      width: clamp(point.x - start.x, MIN_CROP_SIZE, 1 - start.x),
      height: clamp(point.y - start.y, MIN_CROP_SIZE, 1 - start.y)
    });
  };

  const handlePointerUp = () => {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    if (!gesture || !crop) return;

    if (crop.width < MIN_CROP_SIZE || crop.height < MIN_CROP_SIZE) {
      onChange(gesture.start);
    }
  };

  return (
    <Box
      data-testid="crop-preview"
      sx={{
        position: 'relative',
        display: 'inline-block',
        maxWidth: '100%',
        touchAction: 'none',
        userSelect: 'none',
        ...(display ? { width: display.width, height: display.height } : {}),
        transform: `rotate(${rotation}deg)`,
        transition: 'transform 0.15s'
      }}
    >
      <img
        src={src}
        alt="preview"
        draggable={false}
        onLoad={handleLoad}
        style={{
          display: 'block',
          borderRadius: 4,
          transform: `rotate(${orientation || 0}deg)`,
          transition: 'transform 0.15s',
          ...(display && imageBox
            ? {
                position: 'absolute',
                width: imageBox.width,
                height: imageBox.height,
                left: (display.width - imageBox.width) / 2,
                top: (display.height - imageBox.height) / 2
              }
            : { maxWidth: '100%', maxHeight: MAX_PREVIEW.height })
        }}
      />
      <Box
        ref={surfaceRef}
        data-testid="crop-surface"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        sx={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          borderRadius: '4px',
          cursor: 'crosshair'
        }}
      >
        {crop && (
          <Box
            data-testid="crop-region"
            data-crop-role="region"
            sx={{
              position: 'absolute',
              left: percent(crop.x),
              top: percent(crop.y),
              width: percent(crop.width),
              height: percent(crop.height),
              border: '1px solid rgba(255,255,255,0.9)',
              // dims everything outside the selection without extra elements
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
              cursor: 'move'
            }}
          >
            <Box
              data-testid="crop-handle"
              data-crop-role="handle"
              sx={{
                position: 'absolute',
                right: -6,
                bottom: -6,
                width: 12,
                height: 12,
                bgcolor: '#fff',
                border: '2px solid #6366f1',
                borderRadius: '2px',
                cursor: 'nwse-resize'
              }}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default CollageCropSelector;
