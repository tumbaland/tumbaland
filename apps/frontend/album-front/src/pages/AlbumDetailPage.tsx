import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
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
  IconButton,
  Pagination,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  useTheme,
  useMediaQuery
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
import ConfirmDialog from '../components/ConfirmDialog';
import EditPhotoDialog from '../components/EditPhotoDialog';
import { Album, Photo } from '../types';

const AlbumDetailPage: React.FC = () => {
  const { albumId } = useParams<{ albumId: string }>();
  const navigate = useNavigate();  const [album, setAlbum] = useState<Album | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [loadingAlbum, setLoadingAlbum] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imgDimensions, setImgDimensions] = useState<{ width: number; height: number } | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<Photo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [photoToEdit, setPhotoToEdit] = useState<Photo | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isPortrait = window.innerHeight > window.innerWidth;
  const {
    photos,
    loading: photosLoading,
    error: photosError,
    pagination,
    fetchPhotos,
    updatePhoto,
    deletePhoto
  } = usePhotos(albumId || '', {
    page: currentPage,
    limit: pageSize === 0 ? undefined : pageSize, // 0 means "All"
    search: searchTerm || undefined
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
    setPhotoToDelete(photo);
    setShowDeleteDialog(true);
  };

  const handleConfirmDeletePhoto = async () => {
    if (!photoToDelete) return;

    setDeleting(true);
    try {
      await deletePhoto(photoToDelete._id);
      setShowDeleteDialog(false);
      setPhotoToDelete(null);
    } catch (err) {
      alert('Failed to delete photo');
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelDeletePhoto = () => {
    setShowDeleteDialog(false);
    setPhotoToDelete(null);
  };

  const handleEditPhoto = (photo: Photo) => {
    setPhotoToEdit(photo);
    setShowEditDialog(true);
  };

  const handleCloseEditPhoto = () => {
    setShowEditDialog(false);
    setPhotoToEdit(null);
  };

  const handleSaveEditPhoto = async (photoId: string, data: { title?: string; description?: string }) => {
    try {
      await updatePhoto(photoId, data);
    } catch (err) {
      console.error('Failed to update photo:', err);
      alert('Failed to update photo');
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

  const handleUploadComplete = () => {
    fetchPhotos();
  };

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);
  const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
    setCurrentPage(value);
  };

  const handlePageSizeChange = (event: any) => {
    const newPageSize = parseInt(event.target.value);
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page when changing page size
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
          onClick={() => setShowUploadDialog(true)}
        >
          Upload Photos
        </Button>
      </Box>
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

      {/* Pagination Controls */}
      <Box 
        display="flex" 
        justifyContent="space-between" 
        alignItems="center" 
        mb={3}
        sx={{ 
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 2, sm: 0 }
        }}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="body2" color="text.secondary">
            {pagination.total} {pagination.total === 1 ? 'photo' : 'photos'} total
          </Typography>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Per page</InputLabel>
            <Select
              value={pageSize}
              onChange={handlePageSizeChange}
              label="Per page"
            >
              <MenuItem value={10}>10</MenuItem>
              <MenuItem value={20}>20</MenuItem>
              <MenuItem value={50}>50</MenuItem>
              <MenuItem value={100}>100</MenuItem>
              <MenuItem value={0}>All</MenuItem>
            </Select>
          </FormControl>
        </Box>
        
        {pageSize > 0 && pagination.pages > 1 && (
          <Pagination
            count={pagination.pages}
            page={currentPage}
            onChange={handlePageChange}
            color="primary"
            size="medium"
            showFirstButton
            showLastButton
          />
        )}
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
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr', lg: '1fr 1fr 1fr 1fr' },
            gap: 3,
          }}
        >
          {photos.map((photo) => (
            <Box key={photo._id}>
              <PhotoCard
                photo={photo}
                onView={handleViewPhoto}
                onEdit={handleEditPhoto}
                onDelete={handleDeletePhoto}
                onSetCover={handleSetCoverPhoto}
                isCoverPhoto={album?.coverPhotoId === photo._id}
              />
            </Box>
          ))}
        </Box>
      )}

      {/* Bottom Pagination */}
      {photos.length > 0 && pageSize > 0 && pagination.pages > 1 && (
        <Box mt={4} display="flex" justifyContent="center">
          <Pagination
            count={pagination.pages}
            page={currentPage}
            onChange={handlePageChange}
            color="primary"
            size="large"
            showFirstButton
            showLastButton
          />
        </Box>
      )}

      {/* Upload Dialog */}
      <FileUpload
        albumId={albumId || ''}
        open={showUploadDialog}
        onClose={() => setShowUploadDialog(false)}
        onUploadComplete={handleUploadComplete}
      />

      {/* Delete Photo Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onClose={handleCancelDeletePhoto}
        onConfirm={handleConfirmDeletePhoto}
        title="Delete Photo"
        message={
          photoToDelete
            ? `Are you sure you want to delete photo?`
            : ''
        }
        confirmText="Delete Photo"
        cancelText="Cancel"
        variant="danger"
        loading={deleting}
      />

      {/* Edit Photo Dialog */}
      <EditPhotoDialog
        open={showEditDialog}
        photo={photoToEdit}
        onClose={handleCloseEditPhoto}
        onSave={handleSaveEditPhoto}
      />
      <Dialog
        open={showPhotoViewer}
        onClose={handleClosePhotoViewer}
        fullScreen
        PaperProps={{
          sx: { bgcolor: 'transparent', boxShadow: 'none' }
        }}
      >
        <DialogContent sx={{ p: 0, m: 0, width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
          <Box
            onClick={handleClosePhotoViewer}
            sx={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              bgcolor: 'rgba(0,0,0,0.5)',
              zIndex: 1,
            }}
          />
          {/* Close Button */}
          <IconButton
            onClick={handleClosePhotoViewer}
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              color: 'white',
              bgcolor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 3,
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
                zIndex: 3,
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
                zIndex: 3,
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
              zIndex: 3
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
              onLoad={e => {
                const img = e.currentTarget as HTMLImageElement;
                setImgDimensions({ width: img.naturalWidth, height: img.naturalHeight });
              }}
              sx={{
                maxWidth: isMobile && imgDimensions && imgDimensions.width > imgDimensions.height && isPortrait ? '100vh' : '90vw',
                maxHeight: isMobile && imgDimensions && imgDimensions.width > imgDimensions.height && isPortrait ? '100vw' : '90vh',
                objectFit: 'contain',
                cursor: 'pointer',
                userSelect: 'none',
                margin: 'auto',
                display: 'block',
                width: 'auto',
                height: 'auto',
                zIndex: 2,
                boxShadow: 3,
                borderRadius: 2,
                background: 'black',
                transform: isMobile && imgDimensions && imgDimensions.width > imgDimensions.height && isPortrait ? 'rotate(90deg)' : 'none',
                transition: 'transform 0.3s',
              }}
              onClick={(e) => {
                e.stopPropagation();
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
