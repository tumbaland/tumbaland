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
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 4,
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }
        }
      }}
    >
      <DialogTitle sx={{ pb: 1, fontWeight: 700 }}>Edit Album</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
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
          sx={{ 
            mb: 2, 
            mt: 2,
            '& .MuiOutlinedInput-root': { borderRadius: 2 }
          }}
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
          sx={{ 
            mb: 2,
            '& .MuiOutlinedInput-root': { borderRadius: 2 }
          }}
        />
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 1 }}>
        <Button 
          onClick={onClose} 
          disabled={saving}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          disabled={saving}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
            '&:hover': {
              boxShadow: '0 6px 16px rgba(99, 102, 241, 0.4)'
            }
          }}
        >
          {saving ? <CircularProgress size={20} color="inherit" /> : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditAlbumDialog;
