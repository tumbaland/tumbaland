import React from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Breadcrumbs,
  Link
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { Album } from '../types';

interface AlbumHeaderProps {
  album: Album;
  onNavigateBack: () => void;
  onUploadPhotos: () => void;
}

const AlbumHeader: React.FC<AlbumHeaderProps> = ({
  album,
  onNavigateBack,
  onUploadPhotos
}) => {
  return (
    <>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link 
          component="button" 
          variant="body1" 
          onClick={onNavigateBack} 
          sx={{ textDecoration: 'none' }}
        >
          Albums
        </Link>
        <Typography color="text.primary">{album.name}</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={4}>
        <Box>
          <Box display="flex" alignItems="center" mb={1}>
            <IconButton onClick={onNavigateBack} sx={{ mr: 1 }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h4" component="h1" sx={{ mr: 1 }}>
              {album.name}
            </Typography>
          </Box>
          {album.description && (
            <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
              {album.description}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            {album.photoCount} {album.photoCount === 1 ? 'photo' : 'photos'}
            {album.isPublic ? ' • Public' : ' • Private'}
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<CloudUploadIcon />} 
          onClick={onUploadPhotos}
        >
          Upload Media
        </Button>
      </Box>
    </>
  );
};

export default AlbumHeader;
