import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Alert,
  CircularProgress,
  Fab,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  LinearProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAlbums } from '../hooks/useAlbums';
import EditAlbumDialog from '../components/EditAlbumDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import { useTenantFilter } from '../components/tenant';
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

  // Debounce search term to prevent excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
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
    fetchAlbums
  } = useAlbums({
    search: debouncedSearchTerm || undefined,
    groupId: tenantGroupId,
    limit: 20
  });

  const handleCreateAlbum = async (albumData: { name: string; description: string; tags: string[]; groupId?: string }) => {
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
      await deleteAlbum(albumToDelete._id);
      setShowDeleteDialog(false);
      setAlbumToDelete(null);
    } catch (err) {
      alert('Failed to delete album');
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
    } catch (err) {
      console.error('Failed to update album:', err);
      alert('Failed to update album');
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
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, sm: 4 }, px: { xs: 1, sm: 3 } }}>
      <AlbumsHeader
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onCreateAlbum={() => setShowCreateDialog(true)}
        onRefresh={() => fetchAlbums()}
        loading={loading || isFetching}
      />

      {isFetching && !loading && (
        <LinearProgress sx={{ mb: 4 }} />
      )}

      {albumsError && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {albumsError}
        </Alert>
      )}

      {albums.length === 0 ? (
        <AlbumsEmptyState
          searchTerm={searchTerm}
          onCreateAlbum={() => setShowCreateDialog(true)}
        />
      ) : (
        <AlbumsGrid
          albums={albums}
          onViewAlbum={handleViewAlbum}
          onDeleteAlbum={handleDeleteAlbum}
          onMenuOpen={handleMenuOpen}
        />
      )}

      {/* Options Menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose} onClick={(e) => e.stopPropagation()}>
        <MenuItem onClick={handleMenuEdit}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit Album</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleMenuDelete} disabled={selectedAlbum?.photoCount !== 0}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete Album</ListItemText>
        </MenuItem>
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

      {/* Floating Action Button for mobile */}
      <Fab
        color="primary"
        aria-label="create album"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          display: { xs: 'flex', sm: 'none' }
        }}
        onClick={() => setShowCreateDialog(true)}
      >
        <AddIcon />
      </Fab>
    </Container>
  );
};

export default AlbumsPage;