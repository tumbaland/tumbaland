import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { Collage, CollageInput } from '../../types/collage';
import { useAlbums } from '../../hooks/useAlbums';

interface CollageEditModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (input: CollageInput) => Promise<void>;
  initialData: Collage;
}

export const CollageEditModal: React.FC<CollageEditModalProps> = ({ open, onClose, onSave, initialData }) => {
  const [title, setTitle] = useState(initialData.title);
  const [subtitle, setSubtitle] = useState(initialData.config?.title?.subtitle || '');
  const [albumId, setAlbumId] = useState(initialData.albumId || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { albums, loading: albumsLoading } = useAlbums();

  React.useEffect(() => {
    setTitle(initialData.title);
    setSubtitle(initialData.config?.title?.subtitle || '');
    setAlbumId(initialData.albumId || '');
    setError(null);
  }, [initialData, open]);

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      await onSave({
        title,
        config: {
          ...initialData.config,
          title: { text: title, subtitle }
        },
        ownerId: initialData.ownerId,
        albumId
      });
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to update collage');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Edit Collage</DialogTitle>
      <DialogContent>
        <FormControl fullWidth margin="dense" disabled={albumsLoading || loading}>
          <InputLabel id="album-edit-select-label">Album</InputLabel>
          <Select
            labelId="album-edit-select-label"
            value={albumId}
            label="Album"
            onChange={(e) => setAlbumId(e.target.value)}
          >
            {albums.map((album) => (
              <MenuItem key={album._id} value={album._id}>
                {album.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          autoFocus
          margin="dense"
          label="Title"
          fullWidth
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={loading}
        />
        <TextField
          margin="dense"
          label="Subtitle"
          fullWidth
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          disabled={loading}
        />
        {error && (
          <Box color="error.main" mt={1}>
            {error}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" color="primary" disabled={loading || !title || !albumId}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};
