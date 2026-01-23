import React, { useState } from 'react';
import { List, ListItem, ListItemAvatar, Avatar, ListItemButton, Typography, Box } from '@mui/material';

export interface AlbumPhoto {
  _id: string;
  filename: string;
  signedUrl: string;
  thumbnailSignedUrl?: string;
  title?: string;
  width?: number;
  height?: number;
}

interface AlbumPhotoListProps {
  photos: AlbumPhoto[];
  onPhotoClick: (photo: AlbumPhoto) => void;
  onPhotoDragStart?: (photo: AlbumPhoto, e: React.DragEvent) => void;
}

const AlbumPhotoList: React.FC<AlbumPhotoListProps> = ({ photos, onPhotoClick, onPhotoDragStart }) => {
  const [hoveredPhoto, setHoveredPhoto] = useState<AlbumPhoto | null>(null);
  const [overlayPos, setOverlayPos] = useState<{ top: number; left: number } | null>(null);

  // Determine the image URL to use for a photo (prefer thumbnail for sidebar)
  const getThumbnailUrl = (photo: AlbumPhoto): string => {
    return photo.thumbnailSignedUrl || photo.signedUrl || '';
  };

  // Determine the image URL for the overlay preview (use full size)
  const getPreviewUrl = (photo: AlbumPhoto): string => {
    return photo.signedUrl || photo.thumbnailSignedUrl || '';
  };

  const handleMouseEnter = (e: React.MouseEvent, photo: AlbumPhoto) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const overlayHeight = 260; // match maxHeight below
    let top = rect.top + window.scrollY;
    // If overlay would go off bottom, adjust up
    if (top + overlayHeight > window.innerHeight + window.scrollY) {
      top = window.innerHeight + window.scrollY - overlayHeight - 8;
      if (top < 0) top = 0;
    }
    setHoveredPhoto(photo);
    setOverlayPos({
      top,
      left: rect.right + 8 + window.scrollX
    });
  };
  const handleMouseLeave = () => {
    setHoveredPhoto(null);
    setOverlayPos(null);
  };

  return (
    <>
      <Typography variant="h6" gutterBottom>
        Photos
      </Typography>
      <List sx={{ position: 'relative' }}>
        {photos.map((photo) => (
          <ListItem
            key={photo._id}
            disablePadding
            onMouseEnter={(e) => handleMouseEnter(e, photo)}
            onMouseLeave={handleMouseLeave}
            sx={{ position: 'relative' }}
          >
            <ListItemButton 
              onClick={() => onPhotoClick(photo)}
              draggable={!!onPhotoDragStart}
              onDragStart={(e) => onPhotoDragStart?.(photo, e)}
            >
              <ListItemAvatar>
                <Avatar src={getThumbnailUrl(photo)} variant="rounded" />
              </ListItemAvatar>
            </ListItemButton>
          </ListItem>
        ))}
        {/* Overlay large image */}
        {hoveredPhoto && overlayPos && (
          <Box
            sx={{
              position: 'fixed',
              top: overlayPos.top,
              left: overlayPos.left,
              zIndex: 1302,
              bgcolor: '#fff',
              borderRadius: 2,
              boxShadow: 6,
              border: '1px solid #eee',
              p: 0.5,
              maxWidth: 260,
              maxHeight: 260,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none'
            }}
          >
            <img
              src={getPreviewUrl(hoveredPhoto)}
              alt={hoveredPhoto.filename}
              style={{
                maxWidth: 240,
                maxHeight: 240,
                borderRadius: 8,
                display: 'block',
                objectFit: 'contain',
                pointerEvents: 'none'
              }}
            />
          </Box>
        )}
      </List>
    </>
  );
};

export default AlbumPhotoList;
