import React from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon
} from '@mui/icons-material';
import { Photo, Album } from '../types';
import PhotoCard from './PhotoCard';

interface PhotosGridProps {
  photos: Photo[];
  album: Album;
  searchTerm: string;
  photosLoading: boolean;
  photosError: string | null;
  onViewPhoto: (photo: Photo) => void;
  onEditPhoto: (photo: Photo) => void;
  onDeletePhoto: (photo: Photo) => void;
  onSetCoverPhoto: (photo: Photo) => void;
  onViewPhotoDetails: (photo: Photo) => void;
  onUploadPhotos: () => void;
}

const PhotosGrid: React.FC<PhotosGridProps> = ({
  photos,
  album,
  searchTerm,
  photosLoading,
  photosError,
  onViewPhoto,
  onEditPhoto,
  onDeletePhoto,
  onSetCoverPhoto,
  onViewPhotoDetails,
  onUploadPhotos
}) => {
  // Error Alert
  if (photosError) {
    return (
      <Alert severity="error" sx={{ mb: 4 }}>
        {photosError}
      </Alert>
    );
  }

  // Loading state
  if (photosLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
        <CircularProgress />
      </Box>
    );
  }

  // Empty state
  if (photos.length === 0) {
    return (
      <Box 
        textAlign="center" 
        py={10}
        sx={{
          background: 'rgba(255, 255, 255, 0.4)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: 4,
          border: '1px solid rgba(255, 255, 255, 0.4)',
          mx: 'auto',
          maxWidth: 600,
          mt: 4
        }}
      >
        <CloudUploadIcon sx={{ fontSize: 80, color: 'rgba(99, 102, 241, 0.3)', mb: 3 }} />
        <Typography variant="h5" color="text.primary" gutterBottom fontWeight={600}>
          {searchTerm ? 'No photos found' : 'No photos yet'}
        </Typography>
        <Typography variant="body1" color="text.secondary" mb={4}>
          {searchTerm ? 'Try adjusting your search terms' : 'Upload your first photos to get started'}
        </Typography>
        {!searchTerm && (
          <Button 
            variant="contained" 
            startIcon={<CloudUploadIcon />} 
            onClick={onUploadPhotos}
            sx={{
              borderRadius: 3,
              textTransform: 'none',
              fontWeight: 600,
              px: 4,
              py: 1.5,
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
              '&:hover': {
                boxShadow: '0 6px 16px rgba(99, 102, 241, 0.4)'
              }
            }}
          >
            Upload Media
          </Button>
        )}
      </Box>
    );
  }

  // Photos grid
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',
          sm: 'repeat(3, minmax(0, 1fr))',
          md: 'repeat(4, minmax(0, 1fr))',
          lg: 'repeat(5, minmax(0, 1fr))',
          xl: 'repeat(6, minmax(0, 1fr))'
        },
        gap: { xs: 1.5, sm: 2, md: 3 }
      }}
    >
      {photos.map((photo) => (
        <Box key={photo._id}>
          <PhotoCard
            photo={photo}
            onView={onViewPhoto}
            onEdit={onEditPhoto}
            onDelete={onDeletePhoto}
            onSetCover={onSetCoverPhoto}
            onViewDetails={onViewPhotoDetails}
            isCoverPhoto={album?.coverPhotoId === photo._id}
          />
        </Box>
      ))}
    </Box>
  );
};

export default PhotosGrid;
