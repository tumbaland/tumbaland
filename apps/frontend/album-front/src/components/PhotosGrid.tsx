import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  ViewStream as ViewStreamIcon,
  ViewComfy as ViewComfyIcon,
  ViewCompact as ViewCompactIcon,
  Apps as AppsIcon
} from '@mui/icons-material';
import { Photo, Album, GridDensity } from '../types';
import PhotoCard from './PhotoCard';

const DENSITY_STORAGE_KEY = 'tumbaland:photoGridDensity';
const DENSITIES: GridDensity[] = ['large', 'comfortable', 'compact', 'tiny'];

const GRID_COLUMNS: Record<GridDensity, Record<string, string>> = {
  large: {
    xs: 'repeat(1, minmax(0, 1fr))',
    sm: 'repeat(2, minmax(0, 1fr))',
    md: 'repeat(3, minmax(0, 1fr))',
    lg: 'repeat(4, minmax(0, 1fr))',
    xl: 'repeat(4, minmax(0, 1fr))'
  },
  comfortable: {
    xs: 'repeat(2, minmax(0, 1fr))',
    sm: 'repeat(3, minmax(0, 1fr))',
    md: 'repeat(4, minmax(0, 1fr))',
    lg: 'repeat(5, minmax(0, 1fr))',
    xl: 'repeat(6, minmax(0, 1fr))'
  },
  compact: {
    xs: 'repeat(3, minmax(0, 1fr))',
    sm: 'repeat(4, minmax(0, 1fr))',
    md: 'repeat(6, minmax(0, 1fr))',
    lg: 'repeat(7, minmax(0, 1fr))',
    xl: 'repeat(8, minmax(0, 1fr))'
  },
  tiny: {
    xs: 'repeat(4, minmax(0, 1fr))',
    sm: 'repeat(5, minmax(0, 1fr))',
    md: 'repeat(8, minmax(0, 1fr))',
    lg: 'repeat(10, minmax(0, 1fr))',
    xl: 'repeat(12, minmax(0, 1fr))'
  }
};

const GRID_GAP: Record<GridDensity, Record<string, number>> = {
  large: { xs: 2, sm: 2, md: 3 },
  comfortable: { xs: 1.5, sm: 2, md: 3 },
  compact: { xs: 0.5, sm: 0.75, md: 1 },
  tiny: { xs: 0.25, sm: 0.5, md: 0.75 }
};

const getStoredDensity = (): GridDensity => {
  if (typeof window === 'undefined') return 'comfortable';
  const stored = window.localStorage.getItem(DENSITY_STORAGE_KEY);
  return (DENSITIES as string[]).includes(stored || '') ? (stored as GridDensity) : 'comfortable';
};

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
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelectPhoto?: (photo: Photo) => void;
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
  onUploadPhotos,
  selectMode = false,
  selectedIds,
  onToggleSelectPhoto
}) => {
  const [density, setDensity] = useState<GridDensity>(getStoredDensity);

  useEffect(() => {
    window.localStorage.setItem(DENSITY_STORAGE_KEY, density);
  }, [density]);

  const handleDensityChange = (
    _event: React.MouseEvent<HTMLElement>,
    value: GridDensity | null
  ) => {
    if (value) setDensity(value);
  };

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
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Empty state
  if (photos.length === 0) {
    return (
      <Box
        sx={{
          textAlign: "center",
          py: 10,
          background: 'rgba(255, 255, 255, 0.4)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: 4,
          border: '1px solid rgba(255, 255, 255, 0.4)',
          mx: 'auto',
          maxWidth: 600,
          mt: 4
        }}>
        <CloudUploadIcon sx={{ fontSize: 80, color: 'rgba(99, 102, 241, 0.3)', mb: 3 }} />
        <Typography
          variant="h5"
          gutterBottom
          sx={{
            color: "text.primary",
            fontWeight: 600
          }}>
          {searchTerm ? 'No photos found' : 'No photos yet'}
        </Typography>
        <Typography
          variant="body1"
          sx={{
            color: "text.secondary",
            mb: 4
          }}>
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
    <>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
        <ToggleButtonGroup
          value={density}
          exclusive
          onChange={handleDensityChange}
          size="small"
          aria-label="Grid density"
        >
          <ToggleButton value="large" aria-label="Large grid">
            <Tooltip title="Large (1 per row on mobile)">
              <ViewStreamIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="comfortable" aria-label="Comfortable grid">
            <Tooltip title="Comfortable">
              <ViewComfyIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="compact" aria-label="Compact grid">
            <Tooltip title="Compact">
              <ViewCompactIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="tiny" aria-label="Tiny grid">
            <Tooltip title="Tiny">
              <AppsIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: GRID_COLUMNS[density],
          gap: GRID_GAP[density]
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
              selectMode={selectMode}
              selected={selectedIds?.has(photo._id)}
              onToggleSelect={onToggleSelectPhoto}
            />
          </Box>
        ))}
      </Box>
    </>
  );
};

export default PhotosGrid;
