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
import { CollageCrop, CollagePhotoItem, normalizeCrop } from './collageDoc';
import CollageCropSelector from './CollageCropSelector';

interface CollagePhotoDialogProps {
  open: boolean;
  photo: CollagePhotoItem | null;
  photoSrc?: string;
  onClose: () => void;
  onSave: (
    patch: Pick<CollagePhotoItem, 'caption' | 'rotation' | 'frame'> &
      Partial<Pick<CollagePhotoItem, 'crop' | 'height'>>
  ) => void;
  onDelete: () => void;
}

/** value used to encode "inherit the global frame setting" in the select */
const INHERIT = 'inherit';

/**
 * Height that shows the whole cropped region at the item's current width.
 * Without it the canvas box keeps its old shape and object-fit: cover would
 * trim part of the region the user just selected.
 */
const heightForCrop = (
  width: number,
  natural: { width: number; height: number },
  crop?: CollageCrop
): number | undefined => {
  const regionWidth = (crop?.width ?? 1) * natural.width;
  const regionHeight = (crop?.height ?? 1) * natural.height;
  if (regionWidth <= 0 || regionHeight <= 0) return undefined;
  return (width * regionHeight) / regionWidth;
};

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
  const [crop, setCrop] = useState<CollageCrop | undefined>(undefined);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (photo) {
      setCaption(photo.caption);
      setRotation(photo.rotation);
      setFrame(photo.frame === undefined ? INHERIT : photo.frame ? 'on' : 'off');
      setCrop(photo.crop);
    }
  }, [photo]);

  const handleSave = () => {
    const nextCrop = normalizeCrop(crop);
    const cropChanged = JSON.stringify(nextCrop ?? null) !== JSON.stringify(photo?.crop ?? null);
    // Reshape the box to the crop only when the crop actually changed, so
    // editing just a caption never moves the photo around on the canvas.
    const height =
      cropChanged && photo && naturalSize ? heightForCrop(photo.width, naturalSize, nextCrop) : undefined;

    onSave({
      caption: caption.trim(),
      rotation,
      frame: frame === INHERIT ? undefined : frame === 'on',
      crop: nextCrop,
      ...(height ? { height } : {})
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Photo settings</DialogTitle>
      <DialogContent>
        {photoSrc && (
          <>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                bgcolor: 'rgba(128,128,128,0.12)',
                borderRadius: 1,
                p: 1
              }}
            >
              <CollageCropSelector
                src={photoSrc}
                rotation={rotation}
                crop={crop}
                onChange={setCrop}
                onNaturalSize={setNaturalSize}
              />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, mb: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', flex: 1 }}>
                {crop
                  ? `Showing ${Math.round(crop.width * 100)}% × ${Math.round(crop.height * 100)}% of the photo`
                  : 'Drag on the photo to crop it'}
              </Typography>
              <Button size="small" onClick={() => setCrop(undefined)} disabled={!crop}>
                Clear crop
              </Button>
            </Box>
          </>
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
