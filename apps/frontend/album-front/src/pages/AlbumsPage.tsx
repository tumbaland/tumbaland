import React, { useState, useEffect } from 'react';
import { useTenantFilter } from '@tumbaland/components';
import { logger } from '@tumbaland/frontend-core';
import {
  Box,
  Container,
  Alert,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  LinearProgress,
  Pagination,
  Stack,
  Snackbar,
  Tooltip,
  Typography
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router';
import { useAlbums } from '../hooks/useAlbums';
import EditAlbumDialog from '../components/EditAlbumDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import { Album } from '../types';
import CreateAlbumDialog from '../components/CreateAlbumDialog';
import AlbumsGrid from '../components/AlbumsGrid';
import AlbumsEmptyState from '../components/AlbumsEmptyState';
import AlbumsHeader from '../components/AlbumsHeader';

const AlbumsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const tenantGroupId = useTenantFilter();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [albumToDelete, setAlbumToDelete] = useState<Album | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  // Debounce search term to prevent excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const {
    albums,
    loading,
    isFetching,
    error: albumsError,
    createAlbum,
    updateAlbum,
    deleteAlbum,
    fetchAlbums,
    pagination
  } = useAlbums({
    search: debouncedSearchTerm || undefined,
    groupId: tenantGroupId,
    limit,
    page
  });

  const handleCreateAlbum = async (albumData: {
    name: string;
    description: string;
    tags: string[];
    groupId?: string;
  }) => {
    await createAlbum(albumData);
  };

  const handleDeleteAlbum = async (album: Album) => {
    setAlbumToDelete(album);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!albumToDelete) return;

    setDeleting(true);
    try {
      const deletedName = albumToDelete.name;
      await deleteAlbum(albumToDelete._id);
      setShowDeleteDialog(false);
      setAlbumToDelete(null);
      setToast({ message: `Deleted "${deletedName}"`, severity: 'success' });
    } catch (err) {
      logger.error('Failed to delete album', err);
      setToast({ message: 'Failed to delete album', severity: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteDialog(false);
    setAlbumToDelete(null);
  };

  const handleViewAlbum = (album: Album) => {
    navigate(`/albums/${album._id}`);
  };

  const handleOpenEditDialog = (album: Album) => {
    setEditingAlbum(album);
    setShowEditDialog(true);
  };

  const handleCloseEditDialog = () => {
    setShowEditDialog(false);
    setEditingAlbum(null);
  };

  const handleSaveEditAlbum = async (albumId: string, data: { name: string; description: string }) => {
    try {
      await updateAlbum(albumId, data);
      setToast({ message: 'Album updated', severity: 'success' });
    } catch (err) {
      logger.error('Failed to update album', err);
      setToast({ message: 'Failed to update album', severity: 'error' });
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>, album: Album) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedAlbum(album);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedAlbum(null);
  };

  const handleMenuEdit = () => {
    if (selectedAlbum) {
      handleOpenEditDialog(selectedAlbum);
    }
    handleMenuClose();
  };

  const handleMenuDelete = () => {
    if (selectedAlbum) {
      handleDeleteAlbum(selectedAlbum);
    }
    handleMenuClose();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 1, sm: 4 }, px: { xs: 0, sm: 3 } }}>
      {/* The header's own Create button shows on every screen size, so there
          is no floating button repeating it over the album grid. */}
      <AlbumsHeader
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onCreateAlbum={() => setShowCreateDialog(true)}
        onRefresh={() => fetchAlbums()}
        loading={loading || isFetching}
      />

      {isFetching && !loading && <LinearProgress sx={{ mb: 2 }} />}

      {albumsError && (
        <Alert severity="error" sx={{ mb: { xs: 2, sm: 4 } }}>
          {albumsError}
        </Alert>
      )}

      {albums.length === 0 ? (
        <AlbumsEmptyState searchTerm={searchTerm} onCreateAlbum={() => setShowCreateDialog(true)} />
      ) : (
        <>
          <Stack
            direction="row"
            sx={{
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1,
              mb: { xs: 1.5, sm: 3 }
            }}
          >
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              {pagination.total} {pagination.total === 1 ? 'album' : 'albums'}
            </Typography>
            {pagination.pages > 1 && (
              <Pagination
                count={pagination.pages}
                page={page}
                onChange={(_, value) => setPage(value)}
                color="primary"
                showFirstButton
                showLastButton
              />
            )}
          </Stack>
          <AlbumsGrid
            albums={albums}
            onViewAlbum={handleViewAlbum}
            onDeleteAlbum={handleDeleteAlbum}
            onMenuOpen={handleMenuOpen}
          />
          {pagination.pages > 1 && (
            <Stack spacing={2} sx={{ alignItems: 'center', mt: { xs: 2, sm: 4 }, mb: 2 }}>
              <Pagination
                count={pagination.pages}
                page={page}
                onChange={(_, value) => setPage(value)}
                color="primary"
                showFirstButton
                showLastButton
              />
            </Stack>
          )}
        </>
      )}

      {/* Options Menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose} onClick={(e) => e.stopPropagation()}>
        <MenuItem onClick={handleMenuEdit}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit Album</ListItemText>
        </MenuItem>
        <Tooltip
          title={selectedAlbum && selectedAlbum.photoCount !== 0 ? 'Remove all photos before deleting this album' : ''}
          placement="left"
        >
          <span>
            <MenuItem onClick={handleMenuDelete} disabled={selectedAlbum?.photoCount !== 0}>
              <ListItemIcon>
                <DeleteIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Delete Album</ListItemText>
            </MenuItem>
          </span>
        </Tooltip>
      </Menu>

      {/* Edit Album Dialog */}
      <EditAlbumDialog
        open={showEditDialog}
        album={editingAlbum}
        onClose={handleCloseEditDialog}
        onSave={handleSaveEditAlbum}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Delete Album"
        message={albumToDelete ? `Are you sure you want to delete "${albumToDelete.name}"?` : ''}
        confirmText="Delete Album"
        cancelText="Cancel"
        variant="danger"
        loading={deleting}
      />

      {/* Create Album Dialog */}
      <CreateAlbumDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={handleCreateAlbum}
        tenantGroupId={tenantGroupId}
      />

      {/* Toast feedback for album actions */}
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={3500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast?.severity ?? 'success'} variant="filled" onClose={() => setToast(null)}>
          {toast?.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default AlbumsPage;
