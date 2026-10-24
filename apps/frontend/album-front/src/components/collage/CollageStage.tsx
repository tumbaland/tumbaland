import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { CollageEditor } from '../../hooks/useCollageEditor';
import {
  EDITOR_BACKDROP
} from '@tumbaland/collage-core';
import { CollagePerson, RemoteSelections, StageMotion } from './CollagePeople';
import { CHAT_FILE_DRAG_TYPE } from '../../services/chatDock';
import { Geometry, Point, findCurrent, pinchGeometry } from './stage/geometry';
import { SelectionHandles } from './stage/SelectionHandles';
import { StagePhoto } from './stage/StagePhoto';
import { StageText } from './stage/StageText';
import type { ResolvedPhoto, ResolvePhoto } from './stage/types';

export type { ResolvedPhoto, ResolvePhoto };
export { pinchGeometry };

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

const SNAP_THRESHOLD = 8;
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
