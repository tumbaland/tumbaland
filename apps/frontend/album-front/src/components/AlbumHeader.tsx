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
        <Typography sx={{
          color: "text.primary"
        }}>{album.name}</Typography>
      </Breadcrumbs>
      {/* Header */}
      <Box 
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'flex-start' },
          mb: { xs: 2, sm: 4 },
          background: 'rgba(255, 255, 255, 0.5)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          p: { xs: 2, sm: 3 },
          borderRadius: 4,
          border: '1px solid rgba(255, 255, 255, 0.4)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
        }}
      >
        <Box sx={{ mb: { xs: 2, sm: 0 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <IconButton onClick={onNavigateBack} sx={{ mr: 1, ml: -1 }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography 
              variant="h4" 
              component="h1" 
              sx={{ 
                mr: 1,
                fontWeight: 700,
                fontSize: { xs: '1.5rem', sm: '2.125rem' },
                background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                backgroundClip: 'text',
                textFillColor: 'transparent',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              {album.name}
            </Typography>
          </Box>
          {album.description && (
            <Typography
              variant="body1"
              sx={{
                color: "text.secondary",
                mb: 1,
                pl: { xs: 0, sm: 6 }
              }}>
              {album.description}
            </Typography>
          )}
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              pl: { xs: 0, sm: 6 }
            }}>
            {album.photoCount} {album.photoCount === 1 ? 'photo' : 'photos'}
            {album.isPublic ? ' • Public' : ' • Private'}
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<CloudUploadIcon />} 
          onClick={onUploadPhotos}
          fullWidth={false}
          sx={{
            width: { xs: '100%', sm: 'auto' },
            borderRadius: 3,
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
            '&:hover': {
              boxShadow: '0 6px 16px rgba(99, 102, 241, 0.4)'
            }
          }}
        >
          Upload Media
        </Button>
      </Box>
    </>
  );
};

export default AlbumHeader;
