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
  Close as CloseIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { usePhotos } from '../hooks/usePhotos';
import { albumService } from '../services/albumService';
import PhotoCard from '../components/PhotoCard';
import FileUpload from '../components/FileUpload';
import { Album, Photo } from '../types';

const AlbumDetailPage: React.FC = () => {
  const { albumId } = useParams<{ albumId: string }>();
  const navigate = useNavigate();
  const [album, setAlbum] = useState<Album | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
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
    setSelectedPhoto(photo);
    setShowPhotoViewer(true);
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
      />

      {/* Photo Viewer Dialog */}
      <Dialog
        open={showPhotoViewer}
        onClose={() => setShowPhotoViewer(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { bgcolor: 'black' }
        }}
      >
        <DialogContent sx={{ p: 0, position: 'relative' }}>
          <IconButton
            onClick={() => setShowPhotoViewer(false)}
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              color: 'white',
              bgcolor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1,
              '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.7)' }
            }}
          >
            <CloseIcon />
          </IconButton>
          {selectedPhoto && (
            <Box
              component="img"
              src={selectedPhoto.signedUrl}
              alt={selectedPhoto.title || selectedPhoto.originalName}
              sx={{
                width: '100%',
                height: 'auto',
                maxHeight: '90vh',
                objectFit: 'contain'
              }}
            />
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
