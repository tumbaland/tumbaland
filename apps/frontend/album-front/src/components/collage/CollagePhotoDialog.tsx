import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Slider,
  TextField,
  Typography
} from '@mui/material';
import { CollagePhotoItem } from './collageDoc';

interface CollagePhotoDialogProps {
  open: boolean;
  photo: CollagePhotoItem | null;
  photoSrc?: string;
  onClose: () => void;
  onSave: (patch: Pick<CollagePhotoItem, 'caption' | 'rotation' | 'frame'>) => void;
  onDelete: () => void;
}

/** value used to encode "inherit the global frame setting" in the select */
const INHERIT = 'inherit';

const CollagePhotoDialog: React.FC<CollagePhotoDialogProps> = ({
  open,
  photo,
  photoSrc,
  onClose,
  onSave,
  onDelete
}) => {
  const [caption, setCaption] = useState('');
  const [rotation, setRotation] = useState(0);
  const [frame, setFrame] = useState<string>(INHERIT);

  useEffect(() => {
    if (photo) {
      setCaption(photo.caption);
      setRotation(photo.rotation);
      setFrame(photo.frame === undefined ? INHERIT : photo.frame ? 'on' : 'off');
    }
  }, [photo]);

  const handleSave = () => {
    onSave({
      caption: caption.trim(),
      rotation,
      frame: frame === INHERIT ? undefined : frame === 'on'
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Photo settings</DialogTitle>
      <DialogContent>
        {photoSrc && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              mb: 2,
              bgcolor: 'rgba(128,128,128,0.12)',
              borderRadius: 1,
              p: 1
            }}
          >
            <img
              src={photoSrc}
              alt="preview"
              style={{
                maxWidth: '100%',
                maxHeight: 160,
                borderRadius: 4,
                transform: `rotate(${rotation}deg)`,
                transition: 'transform 0.15s'
              }}
            />
          </Box>
        )}
        <TextField
          autoFocus
          label="Caption"
          fullWidth
          margin="dense"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Add a caption…"
        />
        <Box sx={{ mt: 2, px: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }} gutterBottom>
            Rotation: {rotation}°
          </Typography>
          <Slider
            value={rotation}
            onChange={(_, v) => setRotation(v as number)}
            min={-180}
            max={180}
            valueLabelDisplay="auto"
          />
        </Box>
        <TextField
          select
          label="Frame"
          fullWidth
          margin="dense"
          value={frame}
          onChange={(e) => setFrame(e.target.value)}
        >
          <MenuItem value={INHERIT}>Use collage setting</MenuItem>
          <MenuItem value="on">Always framed</MenuItem>
          <MenuItem value="off">Never framed</MenuItem>
        </TextField>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={() => { onDelete(); onClose(); }} color="error">
          Remove from collage
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          Apply
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CollagePhotoDialog;
