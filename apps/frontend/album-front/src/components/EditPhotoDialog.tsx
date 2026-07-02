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
      slotProps={{
        paper: {
          sx: {
            borderRadius: 4,
            background: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.6)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
          }
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, pt: 3, px: 3 }}>
        <Box sx={{ fontWeight: 700, fontSize: '1.5rem' }}>Edit Photo</Box>
        <IconButton onClick={handleClose} disabled={saving} sx={{ color: 'text.secondary' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1, px: 3 }}>
        {photo && (
          <Box>
            {/* Photo Preview */}
            <Box
              sx={{
                width: '100%',
                height: 240,
                borderRadius: 3,
                overflow: 'hidden',
                mb: 3,
                mt: 1,
                backgroundColor: 'rgba(0,0,0,0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(0,0,0,0.05)'
              }}
            >
              {photo.signedUrl ? (
                <img
                  src={photo.signedUrl}
                  alt={photo.title || photo.originalName}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    padding: '8px'
                  }}
                />
              ) : (
                <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>No preview available</Box>
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
              sx={{ 
                mb: 3,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  backgroundColor: 'rgba(255, 255, 255, 0.5)',
                  '& fieldset': {
                    borderColor: 'rgba(0, 0, 0, 0.1)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(99, 102, 241, 0.5)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#6366f1',
                  }
                }
              }}
            />

            <TextField
              margin="dense"
              label="Description (optional)"
              fullWidth
              multiline
              rows={4}
              variant="outlined"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
              sx={{ 
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  backgroundColor: 'rgba(255, 255, 255, 0.5)',
                  '& fieldset': {
                    borderColor: 'rgba(0, 0, 0, 0.1)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(99, 102, 241, 0.5)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#6366f1',
                  }
                }
              }}
            />
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
        <Button 
          onClick={handleClose} 
          disabled={saving} 
          variant="outlined"
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            borderColor: 'rgba(0,0,0,0.12)',
            color: 'text.primary',
            '&:hover': {
              borderColor: 'rgba(0,0,0,0.24)',
              bgcolor: 'rgba(0,0,0,0.04)'
            }
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
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
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditPhotoDialog;
