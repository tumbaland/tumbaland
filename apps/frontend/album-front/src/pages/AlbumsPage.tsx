import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Alert,
  CircularProgress,
  Fab,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  PhotoLibrary as PhotoLibraryIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAlbums } from '../hooks/useAlbums';
import AlbumCard from '../components/AlbumCard';
import EditAlbumDialog from '../components/EditAlbumDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import { useTenantFilter } from '../components/tenant';
import { Album } from '../types';

const AlbumsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const tenantGroupId = useTenantFilter(); // Get groupId from tenant context
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newAlbum, setNewAlbum] = useState({
    name: '',
    description: '',
    tags: [] as string[],
    groupId: undefined as string | undefined
  });
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
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
    error: albumsError,
    createAlbum,
    updateAlbum,
    deleteAlbum,
    fetchAlbums
  } = useAlbums({
    search: debouncedSearchTerm || undefined,
    groupId: tenantGroupId, // Pass groupId only if present (group context), undefined for personal
    limit: 20
  });

  const handleCreateAlbum = async () => {
    if (!newAlbum.name.trim()) {
      setError('Album name is required');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      await createAlbum({ ...newAlbum, groupId: tenantGroupId }); // Use tenant context for groupId
      setShowCreateDialog(false);
      setNewAlbum({ name: '', description: '', tags: [], groupId: undefined });
      setTagInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create album');
    } finally {
      setCreating(false);
    }
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

  const handleAddTag = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && tagInput.trim()) {
      event.preventDefault();
      const tag = tagInput.trim();
      if (!newAlbum.tags.includes(tag)) {
        setNewAlbum((prev) => ({
          ...prev,
          tags: [...prev.tags, tag]
        }));
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setNewAlbum((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove)
    }));
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
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={4}
        sx={{
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: { xs: 2, sm: 0 }
        }}
      >
        <Typography variant="h4" component="h1" sx={{ mb: { xs: 1, sm: 0 } }}>
          Albums
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowCreateDialog(true)}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          Create Album
        </Button>
      </Box>

      <Box mb={4} display="flex" gap={2} alignItems="center" flexWrap="wrap">
        <TextField
          placeholder="Search albums..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
          sx={{ maxWidth: 400, flex: 1, minWidth: 200 }}
        />
        <IconButton
          onClick={() => fetchAlbums()}
          disabled={loading}
          color="primary"
          sx={{ flexShrink: 0 }}
          title="Refresh albums"
        >
          <RefreshIcon />
        </IconButton>
      </Box>

      {albumsError && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {albumsError}
        </Alert>
      )}

      {albums.length === 0 ? (
        <Box textAlign="center" py={8}>
          <PhotoLibraryIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {searchTerm ? 'No albums found' : 'No albums yet'}
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            {searchTerm ? 'Try adjusting your search terms' : 'Create your first album to get started'}
          </Typography>
          {!searchTerm && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setShowCreateDialog(true)}>
              Create Album
            </Button>
          )}
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: '1fr 1fr',
              md: '1fr 1fr 1fr',
              lg: '1fr 1fr 1fr 1fr'
            },
            gap: 3
          }}
        >
          {albums.map((album) => (
            <AlbumCard
              key={album._id}
              album={album}
              onView={handleViewAlbum}
              onDelete={handleDeleteAlbum}
              editButton={
                <IconButton
                  onClick={(e) => handleMenuOpen(e, album)}
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    bgcolor: 'rgba(255,255,255,0.9)',
                    boxShadow: 1,
                    zIndex: 2,
                    '&:hover': { bgcolor: 'rgba(255,255,255,1)' }
                  }}
                  aria-label="Album options"
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              }
            />
          ))}
        </Box>
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
      <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Album</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            autoFocus
            margin="dense"
            label="Album Name"
            fullWidth
            variant="outlined"
            value={newAlbum.name}
            onChange={(e) => setNewAlbum((prev) => ({ ...prev, name: e.target.value }))}
            sx={{ mb: 2 }}
          />

          <TextField
            margin="dense"
            label="Description (optional)"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={newAlbum.description}
            onChange={(e) => setNewAlbum((prev) => ({ ...prev, description: e.target.value }))}
            sx={{ mb: 2 }}
          />

          <Box sx={{ mb: 2 }}>
            {tenantGroupId ? (
              <Alert severity="info">
                This album will be created in your selected group context
              </Alert>
            ) : (
              <Alert severity="info">
                This album will be created in your personal context
              </Alert>
            )}
          </Box>

          {/* Removed public/private selection */}

          <TextField
            margin="dense"
            label="Tags (press Enter to add)"
            fullWidth
            variant="outlined"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleAddTag}
            sx={{ mb: 1 }}
          />

          {newAlbum.tags.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
              {newAlbum.tags.map((tag, index) => (
                <Chip key={index} label={tag} onDelete={() => handleRemoveTag(tag)} size="small" />
              ))}
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={handleCreateAlbum} variant="contained" disabled={creating}>
            {creating ? <CircularProgress size={20} /> : 'Create Album'}
          </Button>
        </DialogActions>
      </Dialog>

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
