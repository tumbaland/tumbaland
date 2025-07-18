import React, { useState, useEffect } from 'react';
import {
  Box,
  Dialog,
  DialogContent,
  IconButton,
  Typography,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Close as CloseIcon,
  NavigateBefore as NavigateBeforeIcon,
  NavigateNext as NavigateNextIcon
} from '@mui/icons-material';
import { Photo } from '../types';

interface PhotoViewerProps {
  photos: Photo[];
  selectedPhoto: Photo | null;
  selectedPhotoIndex: number;
  open: boolean;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

const PhotoViewer: React.FC<PhotoViewerProps> = ({
  photos,
  selectedPhoto,
  selectedPhotoIndex,
  open,
  onClose,
  onPrevious,
  onNext
}) => {
  const [imgDimensions, setImgDimensions] = useState<{ width: number; height: number } | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isPortrait = window.innerHeight > window.innerWidth;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!open) return;

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          onPrevious();
          break;
        case 'ArrowRight':
          event.preventDefault();
          onNext();
          break;
        case 'Escape':
          event.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onPrevious, onNext, onClose]);

  if (!selectedPhoto) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      PaperProps={{
        sx: { bgcolor: 'transparent', boxShadow: 'none' }
      }}
    >
      <DialogContent
        sx={{
          p: 0,
          m: 0,
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Background overlay */}
        <Box
          onClick={onClose}
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            bgcolor: 'rgba(0,0,0,0.5)',
            zIndex: 1
          }}
        />

        {/* Close Button */}
        <IconButton
          onClick={onClose}
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            color: 'white',
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 3,
            '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.7)' }
          }}
        >
          <CloseIcon />
        </IconButton>

        {/* Previous Button */}
        {selectedPhotoIndex > 0 && (
          <IconButton
            onClick={onPrevious}
            sx={{
              position: 'absolute',
              left: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'white',
              bgcolor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 3,
              '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.7)' },
              width: 56,
              height: 56
            }}
          >
            <NavigateBeforeIcon fontSize="large" />
          </IconButton>
        )}

        {/* Next Button */}
        {selectedPhotoIndex < photos.length - 1 && (
          <IconButton
            onClick={onNext}
            sx={{
              position: 'absolute',
              right: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'white',
              bgcolor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 3,
              '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.7)' },
              width: 56,
              height: 56
            }}
          >
            <NavigateNextIcon fontSize="large" />
          </IconButton>
        )}

        {/* Photo Counter */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'white',
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            px: 2,
            py: 1,
            borderRadius: 1,
            zIndex: 3
          }}
        >
          <Typography variant="body2">
            {selectedPhotoIndex + 1} of {photos.length}
          </Typography>
        </Box>

        {/* Photo Image */}
        <Box
          component="img"
          src={selectedPhoto.signedUrl}
          alt={selectedPhoto.title || selectedPhoto.originalName}
          onLoad={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            setImgDimensions({ width: img.naturalWidth, height: img.naturalHeight });
          }}
          sx={{
            maxWidth:
              isMobile && imgDimensions && imgDimensions.width > imgDimensions.height && isPortrait
                ? '100vh'
                : '90vw',
            maxHeight:
              isMobile && imgDimensions && imgDimensions.width > imgDimensions.height && isPortrait
                ? '100vw'
                : '90vh',
            objectFit: 'contain',
            cursor: 'pointer',
            userSelect: 'none',
            margin: 'auto',
            display: 'block',
            width: 'auto',
            height: 'auto',
            zIndex: 2,
            boxShadow: 3,
            borderRadius: 2,
            background: 'black',
            transform:
              isMobile && imgDimensions && imgDimensions.width > imgDimensions.height && isPortrait
                ? 'rotate(90deg)'
                : 'none',
            transition: 'transform 0.3s'
          }}
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const imageWidth = rect.width;
            // Click on left third = previous, right third = next, middle = close
            if (clickX < imageWidth / 3 && selectedPhotoIndex > 0) {
              onPrevious();
            } else if (clickX > (2 * imageWidth) / 3 && selectedPhotoIndex < photos.length - 1) {
              onNext();
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
};

export default PhotoViewer;
