import React, { useState } from 'react';
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
  Fab
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  PhotoLibrary as PhotoLibraryIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAlbums } from '../hooks/useAlbums';
import AlbumCard from '../components/AlbumCard';
import { Album } from '../types';

const AlbumsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newAlbum, setNewAlbum] = useState({
    name: '',
    description: '',
    tags: [] as string[]
  });
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const { 
    albums, 
    loading, 
    error: albumsError, 
    createAlbum, 
    deleteAlbum 
  } = useAlbums({
    search: searchTerm || undefined,
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
      await createAlbum(newAlbum);
      setShowCreateDialog(false);
      setNewAlbum({ name: '', description: '', tags: [] });
      setTagInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create album');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteAlbum = async (album: Album) => {
    if (window.confirm(`Are you sure you want to delete "${album.name}"? This will also delete all photos in the album.`)) {
      try {
        await deleteAlbum(album._id);
      } catch (err) {
        alert('Failed to delete album');
      }
    }
  };

  const handleAddTag = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && tagInput.trim()) {
      event.preventDefault();
      const tag = tagInput.trim();
      if (!newAlbum.tags.includes(tag)) {
        setNewAlbum(prev => ({
          ...prev,
          tags: [...prev.tags, tag]
        }));
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setNewAlbum(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleViewAlbum = (album: Album) => {
    navigate(`/albums/${album._id}`);
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

      <Box mb={4}>
        <TextField
          fullWidth
          placeholder="Search albums..."
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
            {searchTerm 
              ? 'Try adjusting your search terms' 
              : 'Create your first album to get started'
            }
          </Typography>
          {!searchTerm && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setShowCreateDialog(true)}
            >
              Create Album
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
          {albums.map((album) => (
            <Box key={album._id}>
              <AlbumCard
                album={album}
                onView={handleViewAlbum}
                onDelete={handleDeleteAlbum}
              />
            </Box>
          ))}
        </Box>
      )}

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
            onChange={(e) => setNewAlbum(prev => ({ ...prev, name: e.target.value }))}
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
            onChange={(e) => setNewAlbum(prev => ({ ...prev, description: e.target.value }))}
            sx={{ mb: 2 }}
          />
          
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
                <Chip
                  key={index}
                  label={tag}
                  onDelete={() => handleRemoveTag(tag)}
                  size="small"
                />
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
