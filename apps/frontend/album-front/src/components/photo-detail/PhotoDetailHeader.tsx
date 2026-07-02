import React from 'react';
import {
  Box,
  Typography,
  Button,
  Breadcrumbs,
  Link,
  IconButton
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Share as ShareIcon
} from '@mui/icons-material';
import { Photo, Album } from '../../types';

interface PhotoDetailHeaderProps {
  photo: Photo;
  album: Album;
  onNavigate: (path: string) => void;
  onDownload: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const PhotoDetailHeader: React.FC<PhotoDetailHeaderProps> = ({
  photo,
  album,
  onNavigate,
  onDownload,
  onEdit,
  onDelete
}) => {
  return (
    <>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          component="button"
          variant="body1"
          onClick={() => onNavigate('/albums')}
          sx={{ textDecoration: 'none' }}
        >
          Albums
        </Link>
        <Link
          component="button"
          variant="body1"
          onClick={() => onNavigate(`/albums/${album._id}`)}
          sx={{ textDecoration: 'none' }}
        >
          {album.name}
        </Link>
        <Typography
          noWrap
          sx={{
            color: "text.primary",
            maxWidth: 200
          }}>
          {photo.title || photo.originalName}
        </Typography>
      </Breadcrumbs>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', md: 'flex-start' },
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
        <Box sx={{ mb: { xs: 2, md: 0 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton onClick={() => onNavigate(`/albums/${album._id}`)} sx={{ mr: 1, ml: -1 }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography
              variant="h4"
              component="h1"
              sx={{
                fontWeight: 700,
                fontSize: { xs: '1.5rem', sm: '2.125rem' },
                background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                backgroundClip: 'text',
                textFillColor: 'transparent',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              {photo.title || photo.originalName}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<ShareIcon />}
            onClick={() => {}}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              borderColor: 'rgba(0,0,0,0.12)',
              color: 'text.primary',
              bgcolor: 'rgba(255,255,255,0.5)',
              '&:hover': {
                borderColor: 'rgba(0,0,0,0.24)',
                bgcolor: 'rgba(255,255,255,0.8)'
              }
            }}
          >
            Share
          </Button>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={onDownload}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
              '&:hover': {
                boxShadow: '0 6px 16px rgba(99, 102, 241, 0.4)'
              }
            }}
          >
            Download
          </Button>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={onEdit}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              borderColor: 'rgba(0,0,0,0.12)',
              color: 'text.primary',
              bgcolor: 'rgba(255,255,255,0.5)',
              '&:hover': {
                borderColor: 'rgba(0,0,0,0.24)',
                bgcolor: 'rgba(255,255,255,0.8)'
              }
            }}
          >
            Edit
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={onDelete}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              bgcolor: 'rgba(255,255,255,0.5)',
              '&:hover': {
                bgcolor: 'rgba(239, 68, 68, 0.08)'
              }
            }}
          >
            Delete
          </Button>
        </Box>
      </Box>
    </>
  );
};

export default PhotoDetailHeader;
