import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  CircularProgress,
  Alert
} from '@mui/material';
import { Album } from '../types';

interface EditAlbumDialogProps {
  open: boolean;
  album: Album | null;
  onClose: () => void;
  onSave: (albumId: string, data: { name: string; description: string }) => Promise<void>;
}

const EditAlbumDialog: React.FC<EditAlbumDialogProps> = ({ open, album, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (album) {
      setName(album.name);
      setDescription(album.description || '');
      setError(null);
    }
  }, [album]);

  const handleSave = async () => {
    if (!album || !name.trim()) {
      setError('Album name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(album._id, { name: name.trim(), description });
      onClose();
    } catch (err) {
      setError('Failed to update album');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Album</DialogTitle>
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
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ mb: 2 }}
        />
        <TextField
          margin="dense"
          label="Description (optional)"
          fullWidth
          multiline
          rows={3}
          variant="outlined"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          sx={{ mb: 2 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={saving}>
          {saving ? <CircularProgress size={20} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditAlbumDialog;
