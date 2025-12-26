import React from 'react';
import { Box } from '@mui/material';
import CollageCanvasPhoto, { CanvasPhoto } from './CollageCanvasPhoto';
import DraggableTextBox, { CanvasText } from './DraggableTextBox';

interface CollageCanvasProps {
  canvasPhotos: CanvasPhoto[];
  canvasTexts: CanvasText[];
  viewport: { width: number; height: number };
  backgroundColor: string;
  isViewMode: boolean;
  dragPhotoId: string | null;
  resizePhotoId: string | null;
  photoTransparencyMode: boolean;
  borderColor: string;
  onPhotoMouseDown: (e: React.MouseEvent, photo: CanvasPhoto) => void;
  onPhotoResizeMouseDown: (e: React.MouseEvent, photo: CanvasPhoto) => void;
  onPhotoContextMenu: (e: React.MouseEvent, idx: number) => void;
  onPhotoDoubleClick: (idx: number) => void;
  setTextBoxes: React.Dispatch<React.SetStateAction<CanvasText[]>>;
  onTextBoxDoubleClick: (idx: number) => void;
  collageConfigPhotos?: any[]; // For fallback captions
}

const CollageCanvas: React.FC<CollageCanvasProps> = ({
  canvasPhotos,
  canvasTexts,
  viewport,
  backgroundColor,
  isViewMode,
  dragPhotoId,
  resizePhotoId,
  photoTransparencyMode,
  borderColor,
  onPhotoMouseDown,
  onPhotoResizeMouseDown,
  onPhotoContextMenu,
  onPhotoDoubleClick,
  setTextBoxes,
  onTextBoxDoubleClick,
  collageConfigPhotos
}) => {
  return (
    <Box
      sx={{
        flex: 1,
        position: 'relative',
        bgcolor: backgroundColor,
        overflow: 'auto',
        minHeight: { xs: '100vh', sm: '100vh' },
        pb: { xs: 8, sm: 0 },
        width: viewport.width,
        height: viewport.height,
        maxWidth: '100vw',
        maxHeight: '100vh',
        margin: '0 auto'
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          minHeight: '100%',
          pb: { xs: 8, sm: 0 }
        }}
      >
        {canvasPhotos.map((photo, idx) => {
          // Fallback caption logic from original file
          let caption = photo.caption;
          if (
            !caption &&
            collageConfigPhotos &&
            collageConfigPhotos[idx] &&
            collageConfigPhotos[idx].caption
          ) {
            caption = collageConfigPhotos[idx].caption;
          }
          
          // Create a merged photo object with the correct caption
          const photoWithCaption = { ...photo, caption };

          return (
            <CollageCanvasPhoto
              key={photo.id}
              photo={photoWithCaption}
              isViewMode={isViewMode}
              isDragging={dragPhotoId === photo.id}
              isResizing={resizePhotoId === photo.id}
              globalTransparencyMode={photoTransparencyMode}
              borderColor={borderColor}
              onMouseDown={onPhotoMouseDown}
              onResizeMouseDown={onPhotoResizeMouseDown}
              onContextMenu={(e) => onPhotoContextMenu(e, idx)}
              onDoubleClick={() => onPhotoDoubleClick(idx)}
            />
          );
        })}

        <DraggableTextBox
          textBoxes={canvasTexts}
          setTextBoxes={setTextBoxes}
          onDoubleClick={onTextBoxDoubleClick}
        />
      </Box>
    </Box>
  );
};

export default CollageCanvas;
