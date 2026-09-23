import React from 'react';
import { Box, Typography, Button, IconButton } from '@mui/material';
import { CloudUpload as CloudUploadIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { Album } from '../types';
import { formatBytes } from '../utils/formatBytes';
import { gradient } from '@tumbaland/frontend-core';

interface AlbumHeaderProps {
  album: Album;
  onNavigateBack: () => void;
  onUploadPhotos: () => void;
}

/**
 * Back, title and upload on one line, the album's facts under it.
 *
 * It replaces a breadcrumb trail plus a padded card holding a second way back
 * and a full-width upload button, which together filled half a phone screen
 * before the first photo.
 */
const AlbumHeader: React.FC<AlbumHeaderProps> = ({ album, onNavigateBack, onUploadPhotos }) => {
  return (
    <Box sx={{ mb: { xs: 1.5, sm: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <IconButton onClick={onNavigateBack} aria-label="Back to albums" sx={{ ml: -1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography
          variant="h5"
          component="h1"
          noWrap
          sx={{ flex: 1, minWidth: 0, fontWeight: 700, color: 'text.primary', fontSize: { xs: '1.25rem', sm: '1.75rem' } }}
        >
          {album.name}
        </Typography>
        <Button
          variant="contained"
          size="small"
          disableElevation
          startIcon={<CloudUploadIcon />}
          onClick={onUploadPhotos}
          aria-label="Upload media"
          sx={{
            flexShrink: 0,
            whiteSpace: 'nowrap',
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            background: gradient.brand
          }}
        >
          Upload
        </Button>
      </Box>

      <Box sx={{ pl: { xs: 0, sm: 5 } }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {album.photoCount} {album.photoCount === 1 ? 'photo' : 'photos'}
          {album.photoCount > 0 && ` • ${formatBytes(album.totalSize)}`}
          {album.isPublic ? ' • Public' : ' • Private'}
        </Typography>
        {album.description && (
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              mt: 0.25,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {album.description}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default AlbumHeader;
