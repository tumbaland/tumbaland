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
      <Box textAlign="center" py={8}>
        <CloudUploadIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          {searchTerm ? 'No photos found' : 'No photos yet'}
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          {searchTerm ? 'Try adjusting your search terms' : 'Upload your first photos to get started'}
        </Typography>
        {!searchTerm && (
          <Button 
            variant="contained" 
            startIcon={<CloudUploadIcon />} 
            onClick={onUploadPhotos}
          >
            Upload Photos
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
          xs: '1fr',
          sm: '1fr 1fr',
          md: '1fr 1fr 1fr',
          lg: '1fr 1fr 1fr 1fr'
        },
        gap: 3
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
            isCoverPhoto={album?.coverPhotoId === photo._id}
          />
        </Box>
      ))}
    </Box>
  );
};

export default PhotosGrid;
