import React from 'react';
import { Fab } from '@mui/material';
import { CloudUpload as CloudUploadIcon } from '@mui/icons-material';

interface AlbumFloatingActionButtonProps {
  onUploadPhotos: () => void;
}

const AlbumFloatingActionButton: React.FC<AlbumFloatingActionButtonProps> = ({
  onUploadPhotos
}) => {
  return (
    <Fab
      color="primary"
      aria-label="upload photos"
      sx={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        display: { xs: 'flex', sm: 'none' }
      }}
      onClick={onUploadPhotos}
    >
      <CloudUploadIcon />
    </Fab>
  );
};

export default AlbumFloatingActionButton;
