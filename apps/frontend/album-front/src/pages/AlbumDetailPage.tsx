import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { logger } from '@tumbaland/frontend-core';
import {
  Box,
  Container,
  Alert,
  CircularProgress,
  Button,
  Typography,
  SelectChangeEvent
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Checklist as ChecklistIcon,
  Close as CloseIcon,
  LocalOffer as LocalOfferIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router';
import { usePhotos } from '../hooks/usePhotos';
import { useAlbumTags, useBulkTagMutation } from '../hooks/useAlbumTags';
import { usePhotoViewer } from '../hooks/usePhotoViewer';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
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
import PhotoTagFilter from '../components/PhotoTagFilter';
import TagPhotosDialog from '../components/TagPhotosDialog';
import { Photo, TagMatch } from '../types';

const AlbumDetailPage: React.FC = () => {
  const { albumId } = useParams<{ albumId: string }>();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<Photo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [photoToEdit, setPhotoToEdit] = useState<Photo | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagMatch, setTagMatch] = useState<TagMatch>('all');
  const [photosToTag, setPhotosToTag] = useState<Photo[] | null>(null);
  const queryClient = useQueryClient();
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);
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
    search: debouncedSearchTerm || undefined,
    tags: selectedTags,
    tagMatch
  });

  // Unpaginated album photo list, so the quick-view modal can step through
  // every photo (not just the current page's) with Previous/Next. When the
  // current page already holds the whole album — a small album, or page size
  // "All" — this is the same list twice, so skip it rather than re-listing
  // every photo (and re-signing a URL per file) for nothing.
  const pageHoldsWholeAlbum = pagination.total > 0 && photos.length >= pagination.total;
  const { photos: fullPhotoList } = usePhotos(
    albumId || '',
    {
      search: debouncedSearchTerm || undefined,
      tags: selectedTags,
      tagMatch
    },
    { enabled: !pageHoldsWholeAlbum }
  );
  const allPhotos = pageHoldsWholeAlbum || fullPhotoList.length === 0 ? photos : fullPhotoList;

  const { tags: albumTags } = useAlbumTags(albumId || '');
  const { bulkUpdateTags } = useBulkTagMutation(albumId || '');

  const {
    selectedPhoto,
    selectedPhotoIndex,
    showPhotoViewer,
    handleViewPhoto,
    handlePreviousPhoto,
    handleNextPhoto,
    handleClosePhotoViewer
  } = usePhotoViewer(allPhotos);


  const handleDeletePhoto = async (photo: Photo) => {
    setPhotoToDelete(photo);
    setShowDeleteDialog(true);
  };

  const handleToggleSelectMode = () => {
    setSelectMode((prev) => !prev);
    setSelectedIds(new Set());
  };

  const handleToggleSelectPhoto = (photo: Photo) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(photo._id)) next.delete(photo._id);
      else next.add(photo._id);
      return next;
    });
  };

  const handleSelectAllOnPage = () => {
    setSelectedIds(new Set(photos.map((p) => p._id)));
  };

  const handleConfirmBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      await Promise.all(Array.from(selectedIds).map((id) => deletePhoto(id)));
      setShowBulkDeleteDialog(false);
      setSelectMode(false);
      setSelectedIds(new Set());
    } catch (err) {
      alert('Failed to delete some photos');
    } finally {
      setBulkDeleting(false);
    }
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

  const handleSaveEditPhoto = async (photoId: string, data: { title?: string; description?: string; tags?: string[] }) => {
    try {
      await updatePhoto(photoId, data);
    } catch (err) {
      logger.error('Failed to update photo', err);
      alert('Failed to update photo');
    }
  };

  const handleEditPhotoTags = (photo: Photo) => {
    setPhotosToTag([photo]);
  };

  const handleTagSelected = () => {
    const selected = photos.filter((photo) => selectedIds.has(photo._id));
    if (selected.length > 0) setPhotosToTag(selected);
  };

  const handleApplyTags = async (photoIds: string[], changes: { add: string[]; remove: string[] }) => {
    try {
      await bulkUpdateTags({ photoIds, ...changes });
      // Leaving select mode on would strand the user on a selection whose tags
      // they just finished editing.
      if (photoIds.length > 1) {
        setSelectMode(false);
        setSelectedIds(new Set());
      }
    } catch (err) {
      logger.error('Failed to update tags', err);
      alert('Failed to update tags');
      throw err;
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

  // Reset to first page when the search or tag filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, selectedTags, tagMatch]);
  const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
    setCurrentPage(value);
  };

  const handlePageSizeChange = (event: SelectChangeEvent<number>) => {
    const newPageSize = typeof event.target.value === 'number' ? event.target.value : parseInt(event.target.value);
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

      <PhotoTagFilter
        tags={albumTags}
        selected={selectedTags}
        match={tagMatch}
        onChange={setSelectedTags}
        onMatchChange={setTagMatch}
      />

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        {selectMode ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {selectedIds.size} selected
            </Typography>
            <Button size="small" onClick={handleSelectAllOnPage}>
              Select all on page
            </Button>
            <Button
              size="small"
              startIcon={<LocalOfferIcon />}
              disabled={selectedIds.size === 0}
              onClick={handleTagSelected}
            >
              Tag
            </Button>
            <Button
              size="small"
              color="error"
              startIcon={<DeleteIcon />}
              disabled={selectedIds.size === 0}
              onClick={() => setShowBulkDeleteDialog(true)}
            >
              Delete
            </Button>
            <Button size="small" startIcon={<CloseIcon />} onClick={handleToggleSelectMode}>
              Cancel
            </Button>
          </Box>
        ) : (
          <Button size="small" startIcon={<ChecklistIcon />} onClick={handleToggleSelectMode}>
            Select
          </Button>
        )}
      </Box>

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
        onEditPhotoTags={handleEditPhotoTags}
        onUploadPhotos={() => setShowUploadDialog(true)}
        selectMode={selectMode}
        selectedIds={selectedIds}
        onToggleSelectPhoto={handleToggleSelectPhoto}
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
        photos={allPhotos}
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

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showBulkDeleteDialog}
        onClose={() => setShowBulkDeleteDialog(false)}
        onConfirm={handleConfirmBulkDelete}
        title="Delete photos"
        message={`Delete ${selectedIds.size} selected photo${selectedIds.size === 1 ? '' : 's'}? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={bulkDeleting}
      />

      {/* Tag Photos Dialog (one photo, or the whole selection) */}
      <TagPhotosDialog
        open={Boolean(photosToTag)}
        photos={photosToTag ?? []}
        suggestions={albumTags}
        onClose={() => setPhotosToTag(null)}
        onApply={handleApplyTags}
      />

      {/* Edit Photo Dialog */}
      <EditPhotoDialog
        open={showEditDialog}
        photo={photoToEdit}
        suggestions={albumTags}
        onClose={handleCloseEditPhoto}
        onSave={handleSaveEditPhoto}
      />
    </Container>
  );
};

export default AlbumDetailPage;
