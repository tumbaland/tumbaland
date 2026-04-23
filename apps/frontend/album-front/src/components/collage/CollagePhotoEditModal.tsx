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
  Switch,
  Slider,
  Typography
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface CollagePhoto {
  id: string;
  src?: string;
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
    rotation?: number;
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
  borderColor
}) => {
  const [caption, setCaption] = useState('');
  const [transparentBackground, setTransparentBackground] = useState<boolean | undefined>(undefined);
  const [showBorder, setShowBorder] = useState<boolean>(true);
  const [rotation, setRotation] = useState<number>(0);

  // Update local state when photo changes
  useEffect(() => {
    if (photo) {
      setCaption(photo.caption || '');
      setTransparentBackground(photo.transparentBackground);
      setShowBorder(photo.showBorder ?? true);
      setRotation(photo.rotation || 0);
    } else {
      setCaption('');
      setTransparentBackground(undefined);
      setShowBorder(true);
      setRotation(0);
    }
  }, [photo]);

  const handleSave = () => {
    if (!photo) return;

    onSave(photo.id, {
      caption: caption.trim() || undefined,
      transparentBackground: transparentBackground,
      showBorder: showBorder,
      rotation: rotation
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
                height: 240,
                borderRadius: 1,
                overflow: 'hidden',
                mb: 3,
                backgroundColor: '#f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}
            >
              <Box
                sx={{
                  width: 160,
                  height: 160,
                  transform: `rotate(${rotation}deg)`,
                  transition: 'transform 0.2s',
                  bgcolor: effectiveTransparency ? 'transparent' : borderColor,
                  boxShadow: effectiveTransparency ? 'none' : '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                  p: effectiveTransparency ? 0 : 1.5,
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {photo.src ? (
                  <img
                    src={photo.src}
                    alt="collage photo"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      borderRadius: 2
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: '#f5f5f5',
                      color: '#616161',
                      borderRadius: 2,
                      p: 2,
                      textAlign: 'center'
                    }}
                  >
                    Image not available
                  </Box>
                )}
              </Box>
            </Box>

            {/* Rotation Slider */}
            <Box sx={{ mb: 3, px: 1 }}>
              <Typography gutterBottom variant="body2" color="text.secondary">
                Rotation: {rotation}°
              </Typography>
              <Slider
                value={rotation}
                onChange={(_, val) => setRotation(val as number)}
                min={-180}
                max={180}
                valueLabelDisplay="auto"
                marks={[
                  { value: -180, label: '-180°' },
                  { value: 0, label: '0°' },
                  { value: 180, label: '180°' },
                ]}
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

            {/* Frame Toggle */}
            <FormControlLabel
              control={
                <Switch
                  checked={!effectiveTransparency}
                  onChange={(e) => handleTransparencyToggle(!e.target.checked)}
                />
              }
              label="Show Frame"
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
