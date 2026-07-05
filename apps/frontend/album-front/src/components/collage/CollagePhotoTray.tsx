import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

/** Shape of photos returned by GET /collages/:id (a projection of Photo). */
export interface AlbumPhoto {
  _id: string;
  filename: string;
  title?: string;
  signedUrl?: string;
  thumbnailSignedUrl?: string;
  width?: number;
  height?: number;
}

interface CollagePhotoTrayProps {
  photos: AlbumPhoto[];
  usedPhotoIds: Set<string>;
  onAddPhoto: (photo: AlbumPhoto) => void;
}

/**
 * Left-hand tray listing all photos from the collage's source albums.
 * Click to add a photo to the canvas center, or drag it onto the canvas.
 */
const CollagePhotoTray: React.FC<CollagePhotoTrayProps> = ({ photos, usedPhotoIds, onAddPhoto }) => {
  return (
    <Box
      sx={{
        width: 196,
        flexShrink: 0,
        bgcolor: '#1c1c1e',
        color: '#fff',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        overflowY: 'auto',
        p: 1
      }}
    >
      <Typography variant="caption" sx={{ px: 0.5, color: 'rgba(255,255,255,0.6)' }}>
        Photos ({photos.length}) — click or drag to add
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 1,
          mt: 1
        }}
      >
        {photos.map((photo) => {
          const used = usedPhotoIds.has(photo._id);
          const src = photo.thumbnailSignedUrl || photo.signedUrl;
          return (
            <Tooltip key={photo._id} title={photo.title || photo.filename} placement="right">
              <Box
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/x-collage-photo', photo._id);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => onAddPhoto(photo)}
                sx={{
                  position: 'relative',
                  aspectRatio: '1',
                  borderRadius: 1,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  bgcolor: 'rgba(255,255,255,0.06)',
                  opacity: used ? 0.55 : 1,
                  transition: 'opacity 0.15s, transform 0.15s',
                  '&:hover': { transform: 'scale(1.04)', opacity: 1 }
                }}
              >
                {src ? (
                  <img
                    src={src}
                    alt={photo.title || photo.filename}
                    loading="lazy"
                    draggable={false}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.65rem',
                      color: 'rgba(255,255,255,0.5)',
                      p: 0.5,
                      textAlign: 'center'
                    }}
                  >
                    No preview
                  </Box>
                )}
                {used && (
                  <CheckCircleIcon
                    sx={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      fontSize: 18,
                      color: '#4ade80',
                      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))'
                    }}
                  />
                )}
              </Box>
            </Tooltip>
          );
        })}
      </Box>
      {photos.length === 0 && (
        <Typography variant="body2" sx={{ p: 1, color: 'rgba(255,255,255,0.5)' }}>
          No photos in the source albums yet.
        </Typography>
      )}
    </Box>
  );
};

export default CollagePhotoTray;
