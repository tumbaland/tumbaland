import React, { CSSProperties, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import BrokenImageIcon from '@mui/icons-material/BrokenImage';
import { CollageEditor } from '../../hooks/useCollageEditor';
import {
  CollageCrop,
  CollageDoc,
  CollagePhotoItem,
  CollageTextItem,
  EDITOR_BACKDROP,
  photoHasFrame
} from './collageDoc';

export interface ResolvedPhoto {
  src?: string;
  thumbSrc?: string;
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
}

type GestureMode = 'move' | 'resize' | 'rotate';

interface Gesture {
  mode: GestureMode;
  itemId: string;
  isText: boolean;
  startClientX: number;
  startClientY: number;
  start: { x: number; y: number; width: number; height: number; rotation: number };
  scale: number;
}

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

const StagePhoto: React.FC<{
  doc: CollageDoc;
  photo: CollagePhotoItem;
  resolved?: ResolvedPhoto;
  selected: boolean;
  readOnly: boolean;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onDoubleClick?: () => void;
}> = ({ doc, photo, resolved, selected, readOnly, onPointerDown, onDoubleClick }) => {
  const framed = photoHasFrame(doc, photo);
  const src = resolved?.src || resolved?.thumbSrc;
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
        outlineOffset: '2px'
      }}
      onPointerDown={readOnly ? undefined : (e) => onPointerDown(e, photo.id)}
      onDoubleClick={readOnly ? undefined : onDoubleClick}
    >
      <Box sx={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: '4px' }}>
        {src ? (
          <img
            src={src}
            alt={resolved?.title || 'collage photo'}
            draggable={false}
            style={{
              ...cropImageStyle(photo.crop),
              objectFit: 'cover',
              display: 'block',
              pointerEvents: 'none'
            }}
          />
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

const StageText: React.FC<{
  text: CollageTextItem;
  selected: boolean;
  readOnly: boolean;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onDoubleClick?: () => void;
}> = ({ text, selected, readOnly, onPointerDown, onDoubleClick }) => (
  <Box
    data-item-id={text.id}
    sx={{
      position: 'absolute',
      left: text.x,
      top: text.y,
      width: text.width,
      height: text.height,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: readOnly ? 'default' : 'grab',
      userSelect: 'none',
      touchAction: 'none',
      outline: selected ? '2px solid #6366f1' : readOnly ? 'none' : '1px dashed rgba(128,128,128,0.4)',
      outlineOffset: '2px',
      borderRadius: '4px'
    }}
    onPointerDown={readOnly ? undefined : (e) => onPointerDown(e, text.id)}
    onDoubleClick={readOnly ? undefined : onDoubleClick}
  >
    <Box
      component="span"
      sx={{
        width: '100%',
        textAlign: 'center',
        whiteSpace: 'pre-line',
        fontWeight: 700,
        letterSpacing: 1,
        lineHeight: 1.15,
        fontSize: text.fontSize,
        color: text.color,
        overflow: 'hidden'
      }}
    >
      {text.text}
    </Box>
  </Box>
);

/** Selection handles rendered in canvas space around the selected item. */
const SelectionHandles: React.FC<{
  item: { x: number; y: number; width: number; height: number; rotation?: number };
  scale: number;
  showRotate: boolean;
  onResizeDown: (e: React.PointerEvent) => void;
  onRotateDown: (e: React.PointerEvent) => void;
}> = ({ item, scale, showRotate, onResizeDown, onRotateDown }) => {
  const handleSize = Math.max(14, 14 / scale);
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
      {showRotate && (
      <Box
        onPointerDown={onRotateDown}
        sx={{
          position: 'absolute',
          left: '50%',
          top: -28 / scale,
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
      )}
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

const CollageStage: React.FC<CollageStageProps> = ({
  editor,
  resolvePhoto,
  readOnly,
  zoom,
  onEditItem,
  onDropPhoto
}) => {
  const { doc, selectedId, selectedItem } = editor;
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
      if (photo) return { item: photo, isText: false };
      const text = doc.texts.find((t) => t.id === id);
      if (text) return { item: text, isText: true };
      return null;
    },
    [doc]
  );

  const startGesture = useCallback(
    (e: React.PointerEvent, id: string, mode: GestureMode) => {
      const found = findItem(id);
      if (!found) return;
      e.preventDefault();
      e.stopPropagation();
      editor.select(id);
      editor.beginGesture();
      gestureRef.current = {
        mode,
        itemId: id,
        isText: found.isText,
        startClientX: e.clientX,
        startClientY: e.clientY,
        start: {
          x: found.item.x,
          y: found.item.y,
          width: found.item.width,
          height: found.item.height,
          rotation: (found.item as CollagePhotoItem).rotation || 0
        },
        scale
      };
    },
    [editor, findItem, scale]
  );

  useEffect(() => {
    if (readOnly) return;

    const onMove = (e: PointerEvent) => {
      const g = gestureRef.current;
      if (!g || !doc) return;
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
        const keepAspect = !g.isText && !e.shiftKey;
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

    const onUp = () => {
      if (!gestureRef.current) return;
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
      if (!onDropPhoto || !canvasRef.current) return;
      const photoId = e.dataTransfer.getData('application/x-collage-photo');
      if (!photoId) return;
      e.preventDefault();
      const rect = canvasRef.current.getBoundingClientRect();
      onDropPhoto(photoId, (e.clientX - rect.left) / scale, (e.clientY - rect.top) / scale);
    },
    [onDropPhoto, scale]
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
        bgcolor: readOnly ? EDITOR_BACKDROP : 'rgba(0,0,0,0.25)'
      }}
      onPointerDown={(e) => {
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
            {doc.photos.map((photo) => (
              <StagePhoto
                key={photo.id}
                doc={doc}
                photo={photo}
                resolved={resolvePhoto(photo.photoId)}
                selected={!readOnly && selectedId === photo.id}
                readOnly={readOnly}
                onPointerDown={handleItemPointerDown}
                onDoubleClick={() => onEditItem?.(photo.id)}
              />
            ))}
            {doc.texts.map((text) => (
              <StageText
                key={text.id}
                text={text}
                selected={!readOnly && selectedId === text.id}
                readOnly={readOnly}
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
            {!readOnly && selectedItem && (
              <SelectionHandles
                item={selectedItem.item}
                scale={scale}
                showRotate={selectedItem.kind === 'photo'}
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
