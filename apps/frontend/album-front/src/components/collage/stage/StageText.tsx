import React from 'react';
import { Box } from '@mui/material';
import {
  CollageTextItem,
  labelRadius,
  SHAPE_OUTLINE_WIDTH,
  SHAPE_PATHS,
  TEXT_SHADOW
} from '@tumbaland/collage-core';
import { FOLLOW_TRANSITION } from '../CollagePeople';
import { textCss } from '../collageElements';

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
export const StageText: React.FC<{
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
