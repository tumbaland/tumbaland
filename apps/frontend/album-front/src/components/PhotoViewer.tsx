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
  NavigateNext as NavigateNextIcon,
  Download as DownloadIcon,
  InfoOutlined as InfoOutlinedIcon
} from '@mui/icons-material';
import { Photo } from '../types';
import { useSwipeNavigation } from '../hooks/useSwipeNavigation';
import { useProgressiveImage } from '../hooks/useProgressiveImage';
import { downloadPhoto } from '../utils/downloadPhoto';
import { formatBytes } from '../utils/formatBytes';

const formatDateTime = (dateString: string) =>
  new Date(dateString).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

/**
 * Size, resolution and EXIF for the open photo. The grid card only carries
 * the upload date now — a thumbnail is for recognising a photo, not for
 * reading its specs — so this is where those details live.
 */
const buildDetails = (photo: Photo, resolution: string | null): Array<{ label: string; value: string }> => {
  const { camera, location, dateTaken } = photo.metadata;
  const settings = camera?.settings;

  const cameraName = [camera?.make, camera?.model].filter(Boolean).join(' ');
  const shotSettings = [
    settings?.iso && `ISO ${settings.iso}`,
    settings?.aperture,
    settings?.shutterSpeed,
    settings?.focalLength
  ]
    .filter(Boolean)
    .join(' · ');
  const place =
    location?.address ?? (location ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : undefined);

  return [
    { label: 'Resolution', value: resolution },
    { label: 'Size', value: formatBytes(photo.size) },
    { label: 'Type', value: photo.mimetype },
    { label: 'Uploaded', value: formatDateTime(photo.createdAt) },
    { label: 'Taken', value: dateTaken ? formatDateTime(dateTaken) : null },
    { label: 'Camera', value: cameraName || null },
    { label: 'Settings', value: shotSettings || null },
    { label: 'Location', value: place ?? null }
  ].filter((row): row is { label: string; value: string } => Boolean(row.value));
};

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
  const [showInfo, setShowInfo] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isPortrait = window.innerHeight > window.innerWidth;
  const swipeHandlers = useSwipeNavigation(onNext, onPrevious);
  const { displaySrc, isFullLoaded } = useProgressiveImage(selectedPhoto?.signedUrl, selectedPhoto?.thumbnailUrl);

  // Measured dimensions belong to the photo that was showing when onLoad
  // fired; carrying them into the next one would report the wrong resolution
  // (and, on mobile, rotate a portrait shot as though it were landscape).
  useEffect(() => {
    setImgDimensions(null);
  }, [selectedPhoto?._id]);

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

  const handleDownload = () => {
    if (!selectedPhoto) return;
    downloadPhoto(selectedPhoto);
  };

  if (!selectedPhoto) return null;

  // Prefer the stored dimensions; fall back to what the browser measured, but
  // only once the full image is in — while the thumbnail is showing, the
  // measured size is the thumbnail's.
  const resolution =
    selectedPhoto.width && selectedPhoto.height
      ? `${selectedPhoto.width}×${selectedPhoto.height}`
      : isFullLoaded && imgDimensions
        ? `${imgDimensions.width}×${imgDimensions.height}`
        : null;
  const details = buildDetails(selectedPhoto, resolution);

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
        onTouchStart={swipeHandlers.onTouchStart}
        onTouchEnd={swipeHandlers.onTouchEnd}
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

        {/* Info Toggle */}
        <IconButton
          onClick={() => setShowInfo((prev) => !prev)}
          aria-label={showInfo ? 'Hide photo details' : 'Show photo details'}
          aria-pressed={showInfo}
          sx={{
            position: 'absolute',
            top: 16,
            right: 128,
            color: 'white',
            bgcolor: showInfo ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.5)',
            zIndex: 3,
            '&:hover': { bgcolor: showInfo ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.7)' }
          }}
        >
          <InfoOutlinedIcon />
        </IconButton>

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
              display: 'flex',
              position: 'absolute',
              left: { xs: 4, sm: 16 },
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'white',
              bgcolor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 3,
              '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.7)' },
              width: { xs: 44, sm: 56 },
              height: { xs: 44, sm: 56 }
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
              display: 'flex',
              position: 'absolute',
              right: { xs: 4, sm: 16 },
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'white',
              bgcolor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 3,
              '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.7)' },
              width: { xs: 44, sm: 56 },
              height: { xs: 44, sm: 56 }
            }}
          >
            <NavigateNextIcon fontSize="large" />
          </IconButton>
        )}

        {/* Details Panel */}
        {showInfo && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 64,
              left: { xs: 8, sm: 16 },
              right: { xs: 8, sm: 'auto' },
              maxWidth: { sm: 380 },
              maxHeight: '45vh',
              overflowY: 'auto',
              color: 'white',
              bgcolor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              px: 2,
              py: 1.5,
              borderRadius: 2,
              zIndex: 3
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, wordBreak: 'break-word' }}>
              {selectedPhoto.title || selectedPhoto.originalName}
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.5 }}>
              {details.map(({ label, value }) => (
                <React.Fragment key={label}>
                  <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    {label}
                  </Typography>
                  <Typography variant="caption" sx={{ wordBreak: 'break-word' }}>
                    {value}
                  </Typography>
                </React.Fragment>
              ))}
            </Box>
          </Box>
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
            src={displaySrc}
            alt={selectedPhoto.title || selectedPhoto.originalName}
            onLoad={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              setImgDimensions({ width: img.naturalWidth, height: img.naturalHeight });
            }}
            sx={{
              // Fixed (not max-) dimensions + objectFit below, so the box stays the
              // same size whether the thumbnail or full-res image is showing — only
              // sharpness changes when the full image swaps in, no resize jump.
              width:
                isMobile && imgDimensions && imgDimensions.width > imgDimensions.height && isPortrait
                  ? '100vh'
                  : '90vw',
              height:
                isMobile && imgDimensions && imgDimensions.width > imgDimensions.height && isPortrait
                  ? '100vw'
                  : '90vh',
              objectFit: 'contain',
              cursor: 'pointer',
              userSelect: 'none',
              margin: 'auto',
              display: 'block',
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
