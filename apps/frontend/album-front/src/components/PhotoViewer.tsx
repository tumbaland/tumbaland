import React, { useState, useEffect } from 'react';
import { logger } from '@tumbaland/frontend-core';
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
  NavigateNext as NavigateNextIcon,
  Download as DownloadIcon
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

  const handleDownload = async () => {
    if (!selectedPhoto || !selectedPhoto.signedUrl) return;
    
    try {
      const response = await fetch(selectedPhoto.signedUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = selectedPhoto.originalName || `photo-${selectedPhoto._id}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Download failed', error);
      window.open(selectedPhoto.signedUrl, '_blank');
    }
  };

  if (!selectedPhoto) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      slotProps={{
        paper: {
          sx: {
            backgroundColor: 'transparent',
            backgroundImage: 'none',
            boxShadow: 'none'
          }
        }
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
            bgcolor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)',
            zIndex: 1
          }}
        />

        {/* Download Button */}
        <IconButton
          onClick={handleDownload}
          sx={{
            position: 'absolute',
            top: 16,
            right: 72,
            color: 'white',
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 3,
            '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.7)' }
          }}
        >
          <DownloadIcon />
        </IconButton>

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
              display: { xs: 'none', sm: 'flex' },
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
              display: { xs: 'none', sm: 'flex' },
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

        {/* Photo/Video Display */}
        {selectedPhoto.mimetype.startsWith('video/') ? (
          <Box
            component="video"
            src={selectedPhoto.signedUrl}
            controls
            sx={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              zIndex: 2,
              boxShadow: 3,
              borderRadius: 2,
              background: 'black'
            }}
          />
        ) : (
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
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PhotoViewer;
