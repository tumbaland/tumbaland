import React from 'react';
import { Box } from '@mui/material';
import AlbumPhotoList, { AlbumPhoto } from './AlbumPhotoList';

interface CollageSidebarProps {
  albumPhotos: AlbumPhoto[];
  onPhotoClick: (photo: AlbumPhoto) => void;
  onPhotoDragStart?: (photo: AlbumPhoto, e: React.DragEvent) => void;
}

const CollageSidebar: React.FC<CollageSidebarProps> = ({ albumPhotos, onPhotoClick, onPhotoDragStart }) => {
  return (
    <Box
      sx={{
        width: 110,
        bgcolor: '#222',
        color: '#fff',
        p: 2,
        borderRight: '1px solid #333',
        overflowY: 'auto'
      }}
    >
      <AlbumPhotoList photos={albumPhotos} onPhotoClick={onPhotoClick} onPhotoDragStart={onPhotoDragStart} />
    </Box>
  );
};

export default CollageSidebar;
