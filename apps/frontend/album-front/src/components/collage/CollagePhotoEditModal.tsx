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
  FormControlLabel,
  Switch
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface CollagePhoto {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  caption?: string;
  transparentBackground?: boolean;
  showBorder?: boolean;
}

interface CollagePhotoEditModalProps {
  open: boolean;
  photo: CollagePhoto | null;
  onClose: () => void;
  onSave: (photoId: string, data: {
    caption?: string;
    transparentBackground?: boolean;
    showBorder?: boolean;
  }) => void;
  onDelete?: (photoId: string) => void;
  globalTransparencyMode: boolean;
  borderColor: string;
  globalBackgroundColor: string;
}

const CollagePhotoEditModal: React.FC<CollagePhotoEditModalProps> = ({
  open,
  photo,
  onClose,
  onSave,
  onDelete,
  globalTransparencyMode,
  borderColor,
  globalBackgroundColor
}) => {
  const [caption, setCaption] = useState('');
  const [transparentBackground, setTransparentBackground] = useState<boolean | undefined>(undefined);
  const [showBorder, setShowBorder] = useState<boolean>(true);

  // Update local state when photo changes
  useEffect(() => {
    if (photo) {
      setCaption(photo.caption || '');
      setTransparentBackground(photo.transparentBackground);
      setShowBorder(photo.showBorder ?? true);
    } else {
      setCaption('');
      setTransparentBackground(undefined);
      setShowBorder(true);
    }
  }, [photo]);

  const handleSave = () => {
    if (!photo) return;

    onSave(photo.id, {
      caption: caption.trim() || undefined,
      transparentBackground: transparentBackground,
      showBorder: showBorder
    });
    onClose();
  };

  const handleTransparencyToggle = (checked: boolean) => {
    setTransparentBackground(checked);
  };

  const handleDelete = () => {
    if (!photo || !onDelete) return;
    onDelete(photo.id);
    onClose();
  };

  const effectiveTransparency = transparentBackground ?? globalTransparencyMode;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 2 }}>
        Photo Settings
        <IconButton onClick={onClose} sx={{ color: 'grey.500' }}>
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
                backgroundColor: effectiveTransparency ? globalBackgroundColor : '#f5f5f5',
                border: showBorder ? `2px solid ${borderColor}` : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}
            >
              <img
                src={photo.src}
                alt="collage photo"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  borderRadius: 6
                }}
              />
            </Box>

            {/* Caption Field */}
            <TextField
              autoFocus
              margin="dense"
              label="Caption"
              fullWidth
              variant="outlined"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add caption..."
              sx={{ mb: 2 }}
            />

            {/* Transparency Toggle */}
            {transparentBackground !== undefined ? (
              <FormControlLabel
                control={
                  <Switch
                    checked={transparentBackground}
                    onChange={(e) => handleTransparencyToggle(e.target.checked)}
                  />
                }
                label={`Transparent background`}
                sx={{ mb: 1 }}
              />
            ) : (
              <FormControlLabel
                control={
                  <Switch
                    checked={false}
                    onChange={() => handleTransparencyToggle(!globalTransparencyMode)}
                  />
                }
                label={`Override transparency (currently ${globalTransparencyMode ? 'on' : 'off'})`}
                sx={{ mb: 1 }}
              />
            )}

            {/* Border Toggle */}
            <FormControlLabel
              control={
                <Switch
                  checked={showBorder}
                  onChange={(e) => setShowBorder(e.target.checked)}
                />
              }
              label="Show border"
              sx={{ mb: 1 }}
            />
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        {onDelete && (
          <Button onClick={handleDelete} color="error" variant="outlined">
            Delete
          </Button>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onClose} variant="outlined">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CollagePhotoEditModal;
