import React from 'react';
import { Box } from '@mui/material';
import { coarsePointer } from './geometry';

/** Selection handles rendered in canvas space around the selected item. */
export const SelectionHandles: React.FC<{
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
