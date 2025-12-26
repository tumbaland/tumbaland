import React from 'react';
import { Box } from '@mui/material';

export interface CanvasPhoto {
  id: string;
  fileId?: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  caption?: string;
  transparentBackground?: boolean;
  showBorder?: boolean;
}

interface CollageCanvasPhotoProps {
  photo: CanvasPhoto;
  isViewMode: boolean;
  isDragging: boolean;
  isResizing: boolean;
  globalTransparencyMode: boolean;
  borderColor: string;
  onMouseDown: (e: React.MouseEvent, photo: CanvasPhoto) => void;
  onResizeMouseDown: (e: React.MouseEvent, photo: CanvasPhoto) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
}

const CollageCanvasPhoto: React.FC<CollageCanvasPhotoProps> = ({
  photo,
  isViewMode,
  isDragging,
  isResizing,
  globalTransparencyMode,
  borderColor,
  onMouseDown,
  onResizeMouseDown,
  onContextMenu,
  onDoubleClick
}) => {
  const effectiveTransparency = photo.transparentBackground ?? globalTransparencyMode;

  return (
    <Box
      sx={{
        position: 'absolute',
        left: photo.x,
        top: photo.y,
        width: photo.width,
        height: photo.height,
        zIndex: 2,
        transform: `rotate(${photo.rotation || 0}deg)`,
        bgcolor: effectiveTransparency ? 'transparent' : borderColor,
        boxShadow: effectiveTransparency 
          ? 'none' 
          : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        p: effectiveTransparency ? 0 : 1.5,
        borderRadius: 1,
        cursor: isViewMode
          ? 'default'
          : isDragging
            ? 'grabbing'
            : isResizing
              ? 'nwse-resize'
              : 'pointer',
        userSelect: 'none',
        transition: 'box-shadow 0.2s',
        '&:hover': {
          zIndex: 10,
          boxShadow: isViewMode ? undefined : '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }
      }}
      onContextMenu={onContextMenu}
    >
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative'
        }}
      >
        <img
          src={photo.src}
          alt="collage"
          onMouseDown={isViewMode ? undefined : (e) => onMouseDown(e, photo)}
          onDoubleClick={isViewMode ? undefined : onDoubleClick}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 6,
            cursor: isViewMode
              ? 'default'
              : isDragging
                ? 'grabbing'
                : isResizing
                  ? 'nwse-resize'
                  : 'pointer'
          }}
          draggable={false}
        />
        {/* Resize handle */}
        {!isViewMode && (
          <Box
            sx={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              width: 16,
              height: 16,
              opacity: 0.7,
              borderRadius: 1,
              cursor: 'nwse-resize',
              zIndex: 10,
              display: 'block'
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              onResizeMouseDown(e, photo);
            }}
          />
        )}
        {photo.caption && (
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              bottom: 0,
              width: '100%',
              bgcolor: 'rgba(255,255,255,0.95)',
              color: '#111',
              px: 1,
              py: 0.5,
              borderBottomLeftRadius: 8,
              borderBottomRightRadius: 8,
              fontSize: { xs: '0.85rem', sm: '0.95rem' },
              textAlign: 'center',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
              zIndex: 20,
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

export default CollageCanvasPhoto;
