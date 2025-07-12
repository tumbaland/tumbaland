
import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { CollageInput } from '../../types/collage';
import { useAlbums } from '../../hooks/useAlbums';

interface CollageCreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: CollageInput) => Promise<void>;
}

const defaultConfig = {
  version: '1.0',
  date: new Date().toISOString(),
  viewport: { width: 1200, height: 800 },
  theme: 'default',
  photos: [],
  textSections: [],
  title: { text: '', subtitle: '' },
};


export const CollageCreateModal: React.FC<CollageCreateModalProps> = ({ open, onClose, onCreate }) => {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [albumId, setAlbumId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { albums, loading: albumsLoading } = useAlbums();

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      await onCreate({
        title,
        config: {
          ...defaultConfig,
          title: { text: title, subtitle },
        },
        albumId,
      });
      setTitle('');
      setSubtitle('');
      setAlbumId('');
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to create collage');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setTitle('');
      setSubtitle('');
      setAlbumId('');
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>New Collage</DialogTitle>
      <DialogContent>
        <FormControl fullWidth margin="dense" disabled={albumsLoading || loading}>
          <InputLabel id="album-select-label">Album</InputLabel>
          <Select
            labelId="album-select-label"
            value={albumId}
            label="Album"
            onChange={e => setAlbumId(e.target.value)}
          >
            {albums.map(album => (
              <MenuItem key={album._id} value={album._id}>{album.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          autoFocus
          margin="dense"
          label="Title"
          fullWidth
          value={title}
          onChange={e => setTitle(e.target.value)}
          disabled={loading}
        />
        <TextField
          margin="dense"
          label="Subtitle"
          fullWidth
          value={subtitle}
          onChange={e => setSubtitle(e.target.value)}
          disabled={loading}
        />
        {error && <Box color="error.main" mt={1}>{error}</Box>}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>Cancel</Button>
        <Button onClick={handleCreate} variant="contained" color="primary" disabled={loading || !title || !albumId}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
};
