import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Button,
  TextField,
  InputAdornment,
  Breadcrumbs,
  Link,
  Alert,
  CircularProgress,
  Fab,
  Dialog,
  DialogContent,
  IconButton
} from '@mui/material';
import {
  Search as SearchIcon,
  CloudUpload as CloudUploadIcon,
  ArrowBack as ArrowBackIcon,
  Close as CloseIcon,
  NavigateBefore as NavigateBeforeIcon,
  NavigateNext as NavigateNextIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { usePhotos } from '../hooks/usePhotos';
import { albumService } from '../services/albumService';
import PhotoCard from '../components/PhotoCard';
import FileUpload from '../components/FileUpload';
import { Album, Photo } from '../types';

const AlbumDetailPage: React.FC = () => {
  const { albumId } = useParams<{ albumId: string }>();
  const navigate = useNavigate();  const [album, setAlbum] = useState<Album | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [loadingAlbum, setLoadingAlbum] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    photos,
    loading: photosLoading,
    error: photosError,
    fetchPhotos,
    deletePhoto
  } = usePhotos(albumId || '', {
    search: searchTerm || undefined,
    limit: 50
  });

  useEffect(() => {
    const fetchAlbum = async () => {
      if (!albumId) return;
      
      try {
        setLoadingAlbum(true);
        const response = await albumService.getAlbumById(albumId);
        setAlbum(response.data);
      } catch (err) {
        setError('Failed to load album');
      } finally {
        setLoadingAlbum(false);
      }
    };

    fetchAlbum();
  }, [albumId]);
  const handleDeletePhoto = async (photo: Photo) => {
    if (window.confirm(`Are you sure you want to delete "${photo.title || photo.originalName}"?`)) {
      try {
        await deletePhoto(photo._id);
      } catch (err) {
        alert('Failed to delete photo');
      }
    }
  };

  const handleSetCoverPhoto = async (photo: Photo) => {
    if (!albumId) return;
    
    try {
      const response = await albumService.setCoverPhoto(albumId, photo._id);
      setAlbum(response.data);
      // Show success message
      alert('Cover photo updated successfully!');
    } catch (err) {
      alert('Failed to set cover photo');
    }
  };
  const handleViewPhoto = (photo: Photo) => {
    const photoIndex = photos.findIndex(p => p._id === photo._id);
    setSelectedPhoto(photo);
    setSelectedPhotoIndex(photoIndex);
    setShowPhotoViewer(true);
  };

  const handlePreviousPhoto = () => {
    if (selectedPhotoIndex > 0) {
      const newIndex = selectedPhotoIndex - 1;
      setSelectedPhotoIndex(newIndex);
      setSelectedPhoto(photos[newIndex]);
    }
  };

  const handleNextPhoto = () => {
    if (selectedPhotoIndex < photos.length - 1) {
      const newIndex = selectedPhotoIndex + 1;
      setSelectedPhotoIndex(newIndex);
      setSelectedPhoto(photos[newIndex]);
    }
  };

  const handleClosePhotoViewer = () => {
    setShowPhotoViewer(false);
    setSelectedPhoto(null);
    setSelectedPhotoIndex(0);
  };

  // Keyboard navigation for photo viewer
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!showPhotoViewer) return;

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          handlePreviousPhoto();
          break;
        case 'ArrowRight':
          event.preventDefault();
          handleNextPhoto();
          break;
        case 'Escape':
          event.preventDefault();
          handleClosePhotoViewer();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showPhotoViewer, selectedPhotoIndex, photos.length]);

  // Touch/swipe navigation for mobile
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && selectedPhotoIndex < photos.length - 1) {
      handleNextPhoto();
    }
    if (isRightSwipe && selectedPhotoIndex > 0) {
      handlePreviousPhoto();
    }
  };

  const handleUploadComplete = () => {
    fetchPhotos();
  };

  if (loadingAlbum) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !album) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">
          {error || 'Album not found'}
        </Alert>
        <Button onClick={() => navigate('/albums')} sx={{ mt: 2 }}>
          Back to Albums
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          component="button"
          variant="body1"
          onClick={() => navigate('/albums')}
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
            <IconButton onClick={() => navigate('/albums')} sx={{ mr: 1 }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h4" component="h1">
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
          onClick={() => setShowUploadDialog(true)}
        >
          Upload Photos
        </Button>
      </Box>

      {/* Search */}
      <Box mb={4}>
        <TextField
          placeholder="Search photos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ maxWidth: 400 }}
        />
      </Box>

      {/* Error Alert */}
      {photosError && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {photosError}
        </Alert>
      )}

      {/* Photos Grid */}
      {photosLoading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
          <CircularProgress />
        </Box>
      ) : photos.length === 0 ? (
        <Box textAlign="center" py={8}>
          <CloudUploadIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {searchTerm ? 'No photos found' : 'No photos yet'}
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            {searchTerm 
              ? 'Try adjusting your search terms' 
              : 'Upload your first photos to get started'
            }
          </Typography>
          {!searchTerm && (
            <Button
              variant="contained"
              startIcon={<CloudUploadIcon />}
              onClick={() => setShowUploadDialog(true)}
            >
              Upload Photos
            </Button>
          )}
        </Box>
      ) : (        <Grid container spacing={2}>
          {photos.map((photo) => (
            <Grid item xs={6} sm={4} md={3} lg={2} key={photo._id}>
              <PhotoCard
                photo={photo}
                onView={handleViewPhoto}
                onDelete={handleDeletePhoto}
                onSetCover={handleSetCoverPhoto}
                isCoverPhoto={album?.coverPhotoId === photo._id}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Upload Dialog */}
      <FileUpload
        albumId={albumId || ''}
        open={showUploadDialog}
        onClose={() => setShowUploadDialog(false)}
        onUploadComplete={handleUploadComplete}
      />      {/* Photo Viewer Dialog */}
      <Dialog
        open={showPhotoViewer}
        onClose={handleClosePhotoViewer}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { bgcolor: 'black' }
        }}
      >
        <DialogContent sx={{ p: 0, position: 'relative' }}>
          {/* Close Button */}
          <IconButton
            onClick={handleClosePhotoViewer}
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              color: 'white',
              bgcolor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 2,
              '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.7)' }
            }}
          >
            <CloseIcon />
          </IconButton>

          {/* Previous Button */}
          {selectedPhotoIndex > 0 && (
            <IconButton
              onClick={handlePreviousPhoto}
              sx={{
                position: 'absolute',
                left: 16,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'white',
                bgcolor: 'rgba(0, 0, 0, 0.5)',
                zIndex: 2,
                '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.7)' },
                width: 56,
                height: 56
              }}
            >
              <NavigateBeforeIcon fontSize="large" />
            </IconButton>
          )}

          {/* Next Button */}
          {selectedPhotoIndex < photos.length - 1 && (
            <IconButton
              onClick={handleNextPhoto}
              sx={{
                position: 'absolute',
                right: 16,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'white',
                bgcolor: 'rgba(0, 0, 0, 0.5)',
                zIndex: 2,
                '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.7)' },
                width: 56,
                height: 56
              }}
            >
              <NavigateNextIcon fontSize="large" />
            </IconButton>
          )}

          {/* Photo Counter */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              color: 'white',
              bgcolor: 'rgba(0, 0, 0, 0.5)',
              px: 2,
              py: 1,
              borderRadius: 1,
              zIndex: 2
            }}
          >
            <Typography variant="body2">
              {selectedPhotoIndex + 1} of {photos.length}
            </Typography>
          </Box>          {/* Photo Image */}
          {selectedPhoto && (
            <Box
              component="img"
              src={selectedPhoto.signedUrl}
              alt={selectedPhoto.title || selectedPhoto.originalName}
              sx={{
                width: '100%',
                height: 'auto',
                maxHeight: '90vh',
                objectFit: 'contain',
                cursor: 'pointer',
                userSelect: 'none'
              }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const imageWidth = rect.width;
                
                // Click on left third = previous, right third = next, middle = close
                if (clickX < imageWidth / 3 && selectedPhotoIndex > 0) {
                  handlePreviousPhoto();
                } else if (clickX > (2 * imageWidth) / 3 && selectedPhotoIndex < photos.length - 1) {
                  handleNextPhoto();
                }
              }}
            />
          )}

          {/* Photo Info Overlay */}
          {selectedPhoto && (selectedPhoto.title || selectedPhoto.description) && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 60,
                left: 16,
                right: 16,
                color: 'white',
                bgcolor: 'rgba(0, 0, 0, 0.7)',
                p: 2,
                borderRadius: 1,
                zIndex: 2
              }}
            >
              {selectedPhoto.title && (
                <Typography variant="h6" gutterBottom>
                  {selectedPhoto.title}
                </Typography>
              )}
              {selectedPhoto.description && (
                <Typography variant="body2">
                  {selectedPhoto.description}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Floating Action Button for mobile */}
      <Fab
        color="primary"
        aria-label="upload photos"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          display: { xs: 'flex', sm: 'none' }
        }}
        onClick={() => setShowUploadDialog(true)}
      >
        <CloudUploadIcon />
      </Fab>
    </Container>
  );
};

export default AlbumDetailPage;
