import React, { CSSProperties, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box } from '@mui/material';
import BrokenImageIcon from '@mui/icons-material/BrokenImage';
import { CollageEditor } from '../../hooks/useCollageEditor';
import {
  CollageCrop,
  CollageDoc,
  CollagePhotoItem,
  CollageTextItem,
  EDITOR_BACKDROP,
  isQuarterTurned,
  isVideoType,
  orientationTurns,
  photoHasFrame,
  sourceCrop,
  labelRadius,
  SHAPE_OUTLINE_WIDTH,
  SHAPE_PATHS,
  TEXT_SHADOW
} from '@tumbaland/collage-core';
import { CollagePerson, FOLLOW_TRANSITION, RemoteSelections, StageMotion } from './CollagePeople';
import { CHAT_FILE_DRAG_TYPE } from '../../services/chatDock';
import { textCss } from './collageElements';

export interface ResolvedPhoto {
  src?: string;
  thumbSrc?: string;
  /** A video's still, when there is one. */
  posterSrc?: string;
  /** The file's type: a video is drawn playing rather than as a still. */
  mimetype?: string;
  width?: number;
  height?: number;
  title?: string;
}

export type ResolvePhoto = (photoId: string) => ResolvedPhoto | undefined;


interface CollageStageProps {
  editor: CollageEditor;
  resolvePhoto: ResolvePhoto;
  readOnly: boolean;
  /** 0 = fit to available space, otherwise a fixed zoom factor (1 = 100%) */
  zoom: number;
  onEditItem?: (id: string) => void;
  onDropPhoto?: (photoId: string, x: number, y: number) => void;
  /** A photo dragged in from the chat, by its file id. */
  onDropFile?: (fileId: string, x: number, y: number) => void;
  /** Other people with the collage open; what they have selected is outlined. */
  people?: CollagePerson[];
  /** Items other people are moving right now, drawn where they have them. */
  motions?: StageMotion[];
}

type GestureMode = 'move' | 'resize' | 'rotate';

interface Geometry {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

interface Point {
  x: number;
  y: number;
}

interface Gesture {
  mode: GestureMode | 'pinch';
  itemId: string;
  /** Resizing keeps the proportions: photos and stickers, unless Shift is held. */
  keepAspect: boolean;
  /** The finger or mouse that started it; other pointers' moves are not this gesture's. */
  pointerId: number;
  startClientX: number;
  startClientY: number;
  /** Where that pointer is now, so a second finger can turn this into a pinch. */
  last: Point;
  start: Geometry;
  scale: number;
  /** Pinch only: the second finger, and where both started. */
  secondId?: number;
  second?: Point;
  pinchFrom?: { a: Point; b: Point };
}

/** Smallest an item can be made, in canvas units. */
const MIN_SIZE = 40;

/** Handles on a touch screen: a fingertip, not a cursor. */
const coarsePointer = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
const angleOf = (a: Point, b: Point) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;

/** An angle in (-180, 180], the range rotations are stored in. */
const normalizeAngle = (angle: number) => {
  let a = angle % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return a;
};

/**
 * Two fingers on an item: spreading them resizes it about its centre, turning
 * them turns it, and moving both moves it.
 */
export const pinchGeometry = (
  start: Geometry,
  from: { a: Point; b: Point },
  to: { a: Point; b: Point },
  scale: number
): Geometry => {
  const startDistance = distance(from.a, from.b);
  let factor = startDistance > 0 ? distance(to.a, to.b) / startDistance : 1;
  factor = Math.max(factor, MIN_SIZE / Math.max(1, Math.min(start.width, start.height)));
  const width = start.width * factor;
  const height = start.height * factor;

  const mid = (p: { a: Point; b: Point }) => ({ x: (p.a.x + p.b.x) / 2, y: (p.a.y + p.b.y) / 2 });
  const fromMid = mid(from);
  const toMid = mid(to);
  const centerX = start.x + start.width / 2 + (toMid.x - fromMid.x) / scale;
  const centerY = start.y + start.height / 2 + (toMid.y - fromMid.y) / scale;

  const rotation = Math.round(normalizeAngle(start.rotation + angleOf(to.a, to.b) - angleOf(from.a, from.b)));
  return { x: centerX - width / 2, y: centerY - height / 2, width, height, rotation };
};

const SNAP_THRESHOLD = 8;
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

const StagePhoto: React.FC<{
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
                ...cropImageStyle(sourceCrop(photo)),
                objectFit: 'cover',
                display: 'block',
                pointerEvents: 'none'
              }}
            />
          </Box>
        ) : src ? (
          <Box sx={orientedLayer(content, photo.orientation)}>
            <img
              src={src}
              alt={resolved?.title || 'collage photo'}
              draggable={false}
              style={{
                ...cropImageStyle(sourceCrop(photo)),
                objectFit: 'cover',
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

/** A shape, stretched to its box; its outline keeps one width whatever the size. */
const ShapeSvg: React.FC<{ item: CollageTextItem }> = ({ item }) => (
  <svg
    viewBox="0 0 100 100"
    preserveAspectRatio="none"
    width="100%"
    height="100%"
    style={{
      display: 'block',
      overflow: 'visible',
      filter: item.shadow
        ? `drop-shadow(0 ${TEXT_SHADOW.offsetY}px ${TEXT_SHADOW.blur / 2}px ${TEXT_SHADOW.color})`
        : undefined
    }}
  >
    <path
      d={SHAPE_PATHS[item.shape!]}
      fill={item.color}
      stroke={item.outline || 'none'}
      strokeWidth={item.outline ? SHAPE_OUTLINE_WIDTH : 0}
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
    />
  </svg>
);

/** A text, sticker or shape: everything on the layer above the photos. */
const StageText: React.FC<{
  text: CollageTextItem;
  selected: boolean;
  readOnly: boolean;
  followed?: boolean;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onDoubleClick?: () => void;
}> = ({ text, selected, readOnly, followed, onPointerDown, onDoubleClick }) => {
  const shape = text.kind === 'shape' && text.shape;
  const label = !shape && text.kind !== 'sticker' && text.background;
  return (
    <Box
      data-item-id={text.id}
      sx={{
        position: 'absolute',
        left: text.x,
        top: text.y,
        width: text.width,
        height: text.height,
        transform: text.rotation ? `rotate(${text.rotation}deg)` : undefined,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: readOnly ? 'default' : 'grab',
        userSelect: 'none',
        touchAction: 'none',
        bgcolor: label || undefined,
        outline: selected
          ? '2px solid #6366f1'
          : readOnly || shape || text.kind === 'sticker'
            ? 'none'
            : '1px dashed rgba(128,128,128,0.4)',
        outlineOffset: '2px',
        borderRadius: label ? `${labelRadius(text)}px` : '4px',
        transition: followed ? FOLLOW_TRANSITION : undefined
      }}
      onPointerDown={readOnly ? undefined : (e) => onPointerDown(e, text.id)}
      onDoubleClick={readOnly ? undefined : onDoubleClick}
    >
      {shape ? (
        <ShapeSvg item={text} />
      ) : (
        <Box
          component="span"
          sx={{
            width: '100%',
            boxSizing: 'border-box',
            whiteSpace: 'pre-line',
            overflowWrap: 'break-word',
            overflow: 'hidden',
            ...textCss(text)
          }}
        >
          {text.text}
        </Box>
      )}
    </Box>
  );
};

/** Selection handles rendered in canvas space around the selected item. */
const SelectionHandles: React.FC<{
  item: { x: number; y: number; width: number; height: number; rotation?: number };
  scale: number;
  onResizeDown: (e: React.PointerEvent) => void;
  onRotateDown: (e: React.PointerEvent) => void;
}> = ({ item, scale, onResizeDown, onRotateDown }) => {
  // On screen: 14px under a mouse, 32px under a finger.
  const onScreen = coarsePointer() ? 32 : 14;
  const handleSize = Math.max(onScreen, onScreen / scale);
  return (
    <Box
      sx={{
        position: 'absolute',
        left: item.x,
        top: item.y,
        width: item.width,
        height: item.height,
        transform: `rotate(${item.rotation || 0}deg)`,
        pointerEvents: 'none',
        zIndex: 30
      }}
    >
      {/* rotate handle */}
      <Box
        onPointerDown={onRotateDown}
        sx={{
          position: 'absolute',
          left: '50%',
          top: -(onScreen + 14) / scale,
          transform: 'translateX(-50%)',
          width: handleSize,
          height: handleSize,
          borderRadius: '50%',
          bgcolor: '#6366f1',
          border: '2px solid #fff',
          cursor: 'grab',
          pointerEvents: 'auto',
          touchAction: 'none'
        }}
      />
      {/* resize handle (SE) */}
      <Box
        onPointerDown={onResizeDown}
        sx={{
          position: 'absolute',
          right: -handleSize / 2,
          bottom: -handleSize / 2,
          width: handleSize,
          height: handleSize,
          borderRadius: '2px',
          bgcolor: '#6366f1',
          border: '2px solid #fff',
          cursor: 'nwse-resize',
          pointerEvents: 'auto',
          touchAction: 'none'
        }}
      />
    </Box>
  );
};

/** An item's geometry as it is now in the doc. */
const findCurrent = (doc: CollageDoc, id: string): Geometry | null => {
  const item: (CollagePhotoItem | CollageTextItem) | undefined =
    doc.photos.find((p) => p.id === id) ?? doc.texts.find((t) => t.id === id);
  if (!item) return null;
  return {
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    rotation: item.rotation || 0
  };
};

const CollageStage: React.FC<CollageStageProps> = ({
  editor,
  resolvePhoto,
  readOnly,
  zoom,
  onEditItem,
  onDropPhoto,
  onDropFile,
  people,
  motions
}) => {
  const { doc, selectedId, selectedItem, gestureActive } = editor;

  // Where other people have the items they are moving. Your own drag of the
  // same item wins on your screen: you are the one holding it.
  const followed = useMemo(() => {
    const at = new Map<string, StageMotion['item']>();
    for (const motion of motions ?? []) {
      if (gestureActive && motion.item.id === selectedId) continue;
      at.set(motion.item.id, motion.item);
    }
    return at;
  }, [motions, gestureActive, selectedId]);

  /** The collage as drawn: moving items where their movers have them. */
  const shown = useMemo(() => {
    if (!doc || followed.size === 0) return doc;
    const follow = <T extends { id: string; x: number; y: number; width: number; height: number }>(item: T): T => {
      const at = followed.get(item.id);
      if (!at) return item;
      return {
        ...item,
        x: at.x,
        y: at.y,
        width: at.width,
        height: at.height,
        // Text turns too now, and may have no rotation of its own yet.
        ...(at.rotation !== undefined ? { rotation: at.rotation } : {})
      };
    };
    return { ...doc, photos: doc.photos.map(follow), texts: doc.texts.map(follow) };
  }, [doc, followed]);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const [fitScale, setFitScale] = useState(1);
  const [snapLines, setSnapLines] = useState<{ v: boolean; h: boolean }>({ v: false, h: false });

  const scale = zoom > 0 ? zoom : fitScale;

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || !doc) return;
    const compute = () => {
      const pad = 32;
      const w = Math.max(el.clientWidth - pad, 50);
      const h = Math.max(el.clientHeight - pad, 50);
      setFitScale(Math.min(w / doc.canvas.width, h / doc.canvas.height));
    };
    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(el);
    return () => observer.disconnect();
  }, [doc?.canvas.width, doc?.canvas.height, doc]);

  const findItem = useCallback(
    (id: string) => {
      if (!doc) return null;
      const photo = doc.photos.find((p) => p.id === id);
      if (photo) return { item: photo, keepAspect: true };
      const text = doc.texts.find((t) => t.id === id);
      if (text) return { item: text, keepAspect: text.kind === 'sticker' };
      return null;
    },
    [doc]
  );

  const geometryOf = useCallback((id: string) => (doc ? findCurrent(doc, id) : null), [doc]);

  /**
   * A second finger while one is already on an item: the rest of the gesture
   * is a pinch of that item, wherever the second finger landed. Still one
   * gesture, so it is one step to undo and one save.
   */
  const joinSecondFinger = useCallback(
    (e: React.PointerEvent): boolean => {
      const g = gestureRef.current;
      if (!g || e.pointerType !== 'touch' || e.pointerId === g.pointerId) return false;
      // Extra fingers must not start a new gesture or clear the selection.
      if (g.mode === 'pinch') {
        e.preventDefault();
        e.stopPropagation();
        return true;
      }
      const start = geometryOf(g.itemId);
      if (!start) return false;
      e.preventDefault();
      e.stopPropagation();
      const second = { x: e.clientX, y: e.clientY };
      setSnapLines({ v: false, h: false });
      gestureRef.current = {
        ...g,
        mode: 'pinch',
        start,
        secondId: e.pointerId,
        second,
        pinchFrom: { a: g.last, b: second }
      };
      return true;
    },
    [geometryOf]
  );

  const startGesture = useCallback(
    (e: React.PointerEvent, id: string, mode: GestureMode) => {
      if (joinSecondFinger(e)) return;
      const found = findItem(id);
      const start = geometryOf(id);
      if (!found || !start) return;
      e.preventDefault();
      e.stopPropagation();
      editor.select(id);
      editor.beginGesture();
      gestureRef.current = {
        mode,
        itemId: id,
        keepAspect: found.keepAspect,
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        last: { x: e.clientX, y: e.clientY },
        start,
        scale
      };
    },
    [editor, findItem, geometryOf, joinSecondFinger, scale]
  );

  useEffect(() => {
    if (readOnly) return;

    const onMove = (e: PointerEvent) => {
      const g = gestureRef.current;
      if (!g || !doc) return;

      if (g.mode === 'pinch') {
        const point = { x: e.clientX, y: e.clientY };
        if (e.pointerId === g.pointerId) g.last = point;
        else if (e.pointerId === g.secondId) g.second = point;
        else return;
        editor.gesturePatchItem(g.itemId, pinchGeometry(g.start, g.pinchFrom!, { a: g.last, b: g.second! }, g.scale));
        return;
      }

      if (e.pointerId !== g.pointerId) return;
      g.last = { x: e.clientX, y: e.clientY };
      const dx = (e.clientX - g.startClientX) / g.scale;
      const dy = (e.clientY - g.startClientY) / g.scale;

      if (g.mode === 'move') {
        let x = g.start.x + dx;
        let y = g.start.y + dy;
        // snap item center to canvas center
        const threshold = SNAP_THRESHOLD / g.scale;
        const centerX = x + g.start.width / 2;
        const centerY = y + g.start.height / 2;
        const snapV = Math.abs(centerX - doc.canvas.width / 2) < threshold;
        const snapH = Math.abs(centerY - doc.canvas.height / 2) < threshold;
        if (snapV) x = doc.canvas.width / 2 - g.start.width / 2;
        if (snapH) y = doc.canvas.height / 2 - g.start.height / 2;
        setSnapLines({ v: snapV, h: snapH });
        editor.gesturePatchItem(g.itemId, { x, y });
      } else if (g.mode === 'resize') {
        const minSize = 40;
        let width = Math.max(minSize, g.start.width + dx);
        let height = Math.max(minSize, g.start.height + dy);
        const keepAspect = g.keepAspect && !e.shiftKey;
        if (keepAspect && g.start.height > 0) {
          const ratio = g.start.width / g.start.height;
          if (Math.abs(dx) >= Math.abs(dy)) height = width / ratio;
          else width = height * ratio;
        }
        editor.gesturePatchItem(g.itemId, { width, height });
      } else if (g.mode === 'rotate' && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const cx = rect.left + (g.start.x + g.start.width / 2) * g.scale;
        const cy = rect.top + (g.start.y + g.start.height / 2) * g.scale;
        let angle = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI + 90;
        angle = e.shiftKey ? Math.round(angle / 15) * 15 : Math.round(angle);
        if (angle > 180) angle -= 360;
        editor.gesturePatchItem(g.itemId, { rotation: angle });
      }
    };

    const onUp = (e: PointerEvent) => {
      const g = gestureRef.current;
      if (!g) return;

      if (g.mode === 'pinch' && (e.pointerId === g.pointerId || e.pointerId === g.secondId)) {
        // One finger lifted: the other carries on moving the item from here.
        const remaining = e.pointerId === g.pointerId ? { id: g.secondId!, at: g.second! } : { id: g.pointerId, at: g.last };
        const start = doc ? findCurrent(doc, g.itemId) : null;
        if (start) {
          gestureRef.current = {
            mode: 'move',
            itemId: g.itemId,
            keepAspect: g.keepAspect,
            pointerId: remaining.id,
            startClientX: remaining.at.x,
            startClientY: remaining.at.y,
            last: remaining.at,
            start,
            scale: g.scale
          };
          return;
        }
      } else if (e.pointerId !== g.pointerId) {
        return;
      }

      gestureRef.current = null;
      setSnapLines({ v: false, h: false });
      editor.endGesture();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [doc, editor, readOnly]);

  const handleItemPointerDown = useCallback(
    (e: React.PointerEvent, id: string) => startGesture(e, id, 'move'),
    [startGesture]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;
      const photoId = e.dataTransfer.getData('application/x-collage-photo');
      const fileId = e.dataTransfer.getData(CHAT_FILE_DRAG_TYPE);
      if (photoId && onDropPhoto) {
        e.preventDefault();
        onDropPhoto(photoId, x, y);
      } else if (fileId && onDropFile) {
        e.preventDefault();
        onDropFile(fileId, x, y);
      }
    },
    [onDropPhoto, onDropFile, scale]
  );

  if (!doc) return null;

  return (
    <Box
      ref={containerRef}
      sx={{
        flex: 1,
        overflow: 'auto',
        display: 'flex',
        minWidth: 0,
        bgcolor: readOnly ? EDITOR_BACKDROP : 'rgba(0,0,0,0.25)',
        // One finger still scrolls a zoomed-in canvas; two are the editor's
        // (a pinch of the item being held), never the browser's page zoom.
        touchAction: readOnly ? undefined : 'pan-x pan-y'
      }}
      onPointerDown={(e) => {
        if (joinSecondFinger(e)) return;
        if (e.target === e.currentTarget && !readOnly) editor.select(null);
      }}
    >
      <Box sx={{ m: 'auto', p: 2 }}>
        <Box
          sx={{
            width: doc.canvas.width * scale,
            height: doc.canvas.height * scale,
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 8px 40px rgba(0,0,0,0.5)'
          }}
          onPointerDown={(e) => {
            if (joinSecondFinger(e)) return;
            // clicking canvas background clears selection
            if (!readOnly && (e.target as HTMLElement).closest('[data-item-id]') === null) {
              editor.select(null);
            }
          }}
        >
          <Box
            ref={canvasRef}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            sx={{
              width: doc.canvas.width,
              height: doc.canvas.height,
              transform: `scale(${scale})`,
              transformOrigin: '0 0',
              position: 'absolute',
              top: 0,
              left: 0,
              bgcolor: doc.background
            }}
          >
            {shown!.photos.map((photo) => (
              <StagePhoto
                key={photo.id}
                doc={doc}
                photo={photo}
                resolved={resolvePhoto(photo.photoId)}
                selected={!readOnly && selectedId === photo.id}
                readOnly={readOnly}
                followed={followed.has(photo.id)}
                onPointerDown={handleItemPointerDown}
                onDoubleClick={() => onEditItem?.(photo.id)}
              />
            ))}
            {shown!.texts.map((text) => (
              <StageText
                key={text.id}
                text={text}
                selected={!readOnly && selectedId === text.id}
                readOnly={readOnly}
                followed={followed.has(text.id)}
                onPointerDown={handleItemPointerDown}
                onDoubleClick={() => onEditItem?.(text.id)}
              />
            ))}
            {/* snap guides */}
            {snapLines.v && (
              <Box
                sx={{
                  position: 'absolute',
                  left: doc.canvas.width / 2,
                  top: 0,
                  bottom: 0,
                  width: '1px',
                  bgcolor: '#22d3ee',
                  zIndex: 40,
                  pointerEvents: 'none'
                }}
              />
            )}
            {snapLines.h && (
              <Box
                sx={{
                  position: 'absolute',
                  top: doc.canvas.height / 2,
                  left: 0,
                  right: 0,
                  height: '1px',
                  bgcolor: '#22d3ee',
                  zIndex: 40,
                  pointerEvents: 'none'
                }}
              />
            )}
            {people && people.length > 0 && (
              <RemoteSelections doc={shown!} people={people} motions={motions} scale={scale} />
            )}
            {!readOnly && selectedItem && (
              <SelectionHandles
                item={selectedItem.item}
                scale={scale}
                onResizeDown={(e) => startGesture(e, selectedItem.item.id, 'resize')}
                onRotateDown={(e) => startGesture(e, selectedItem.item.id, 'rotate')}
              />
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default CollageStage;
