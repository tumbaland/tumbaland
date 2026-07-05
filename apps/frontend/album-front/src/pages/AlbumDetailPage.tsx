import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { logger } from '@tumbaland/components';
import {
  Box,
  Container,
  Alert,
  CircularProgress,
  Button
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { usePhotos } from '../hooks/usePhotos';
import { usePhotoViewer } from '../hooks/usePhotoViewer';
import { albumService } from '../services/albumService';
import AlbumHeader from '../components/AlbumHeader';
import PhotoSearchBar from '../components/PhotoSearchBar';
import PhotoPaginationControls from '../components/PhotoPaginationControls';
import PhotosGrid from '../components/PhotosGrid';
import PhotoViewer from '../components/PhotoViewer';
import AlbumFloatingActionButton from '../components/AlbumFloatingActionButton';
import FileUpload from '../components/FileUpload';
import ConfirmDialog from '../components/ConfirmDialog';
import EditPhotoDialog from '../components/EditPhotoDialog';
import { Photo } from '../types';

const AlbumDetailPage: React.FC = () => {
  const { albumId } = useParams<{ albumId: string }>();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<Photo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [photoToEdit, setPhotoToEdit] = useState<Photo | null>(null);
  const queryClient = useQueryClient();
  const albumQuery = useQuery({
    queryKey: ['album', albumId],
    queryFn: () => albumService.getAlbumById(albumId as string),
    enabled: Boolean(albumId)
  });
  const album = albumQuery.data ?? null;
  const loadingAlbum = albumQuery.isPending;
  const albumError = albumQuery.error
    ? albumQuery.error instanceof Error
      ? albumQuery.error.message
      : 'Failed to load album'
    : null;

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

  const {
    selectedPhoto,
    selectedPhotoIndex,
    showPhotoViewer,
    handleViewPhoto,
    handlePreviousPhoto,
    handleNextPhoto,
    handleClosePhotoViewer
  } = usePhotoViewer(photos);


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
      logger.error('Failed to update photo', err);
      alert('Failed to update photo');
    }
  };

  const handleSetCoverPhoto = async (photo: Photo) => {
    if (!albumId) return;

    try {
      const response = await albumService.setCoverPhoto(albumId, photo._id);
      queryClient.setQueryData(['album', albumId], response.data);
      queryClient.invalidateQueries({ queryKey: ['albums'] });
      // Show success message
      alert('Cover photo updated successfully!');
    } catch (err) {
      alert('Failed to set cover photo');
    }
  };

  const handleViewPhotoDetails = (photo: Photo) => {
    navigate(`/albums/${albumId}/photos/${photo._id}`);
  };

  const handleUploadComplete = () => {
    fetchPhotos();
    if (albumId) {
      queryClient.invalidateQueries({ queryKey: ['album', albumId] });
    }
    queryClient.invalidateQueries({ queryKey: ['albums'] });
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
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (albumError || !album) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">{albumError || 'Album not found'}</Alert>
        <Button onClick={() => navigate('/albums')} sx={{ mt: 2 }}>
          Back to Albums
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, sm: 4 }, px: { xs: 1, sm: 3 } }}>
      <AlbumHeader
        album={album}
        onNavigateBack={() => navigate('/albums')}
        onUploadPhotos={() => setShowUploadDialog(true)}
      />

      <PhotoSearchBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
      />

      <PhotoPaginationControls
        pagination={pagination}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        position="top"
      />

      <PhotosGrid
        photos={photos}
        album={album}
        searchTerm={searchTerm}
        photosLoading={photosLoading}
        photosError={photosError}
        onViewPhoto={handleViewPhoto}
        onEditPhoto={handleEditPhoto}
        onDeletePhoto={handleDeletePhoto}
        onSetCoverPhoto={handleSetCoverPhoto}
        onViewPhotoDetails={handleViewPhotoDetails}
        onUploadPhotos={() => setShowUploadDialog(true)}
      />

      <PhotoPaginationControls
        pagination={pagination}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        position="bottom"
      />

      <PhotoViewer
        photos={photos}
        selectedPhoto={selectedPhoto}
        selectedPhotoIndex={selectedPhotoIndex}
        open={showPhotoViewer}
        onClose={handleClosePhotoViewer}
        onPrevious={handlePreviousPhoto}
        onNext={handleNextPhoto}
      />

      <AlbumFloatingActionButton
        onUploadPhotos={() => setShowUploadDialog(true)}
      />

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
        message={photoToDelete ? `Are you sure you want to delete photo?` : ''}
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
    </Container>
  );
};

export default AlbumDetailPage;
