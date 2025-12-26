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
      aria-label="upload media"
      sx={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        display: { xs: 'flex', sm: 'none' },
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
        '&:hover': {
          boxShadow: '0 6px 16px rgba(99, 102, 241, 0.5)'
        }
      }}
      onClick={onUploadPhotos}
    >
      <CloudUploadIcon />
    </Fab>
  );
};

export default AlbumFloatingActionButton;
