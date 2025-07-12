import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  IconButton,
  CircularProgress
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { Photo } from '../types';

interface EditPhotoDialogProps {
  open: boolean;
  photo: Photo | null;
  onClose: () => void;
  onSave: (photoId: string, data: { title?: string; description?: string }) => Promise<void>;
}

const EditPhotoDialog: React.FC<EditPhotoDialogProps> = ({ open, photo, onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Update local state when photo changes
  useEffect(() => {
    if (photo) {
      setTitle(photo.title || '');
      setDescription(photo.description || '');
    } else {
      setTitle('');
      setDescription('');
    }
  }, [photo]);

  const handleSave = async () => {
    if (!photo) return;

    setSaving(true);
    try {
      await onSave(photo._id, {
        title: title.trim() || undefined,
        description: description.trim() || undefined
      });
      onClose();
    } catch (error) {
      console.error('Failed to update photo:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 2 }}>
        Edit Photo
        <IconButton onClick={handleClose} disabled={saving} sx={{ color: 'grey.500' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {photo && (
          <Box>
            {/* Photo Preview */}
            <Box
              sx={{
                width: '100%',
                height: 200,
                borderRadius: 1,
                overflow: 'hidden',
                mb: 3,
                backgroundColor: 'grey.100',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {photo.signedUrl ? (
                <img
                  src={photo.signedUrl}
                  alt={photo.title || photo.originalName}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              ) : (
                <Box sx={{ textAlign: 'center', color: 'grey.500' }}>No preview available</Box>
              )}
            </Box>

            {/* Form Fields */}
            <TextField
              autoFocus
              margin="dense"
              label="Photo Title"
              fullWidth
              variant="outlined"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={photo.originalName}
              disabled={saving}
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
              disabled={saving}
            />
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleClose} disabled={saving} variant="outlined">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} /> : null}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditPhotoDialog;
