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
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import Rotate90DegreesCcwIcon from '@mui/icons-material/Rotate90DegreesCcw';
import Rotate90DegreesCwIcon from '@mui/icons-material/Rotate90DegreesCw';
import {
  CollageCrop,
  CollagePhotoItem,
  isQuarterTurned,
  normalizeCrop,
  normalizeOrientation,
  orientationTurns,
  PhotoFit,
  rotateCropClockwise
} from '@tumbaland/collage-core';
import CollageCropSelector from './CollageCropSelector';

interface CollagePhotoDialogProps {
  open: boolean;
  photo: CollagePhotoItem | null;
  photoSrc?: string;
  onClose: () => void;
  onSave: (
    patch: Pick<CollagePhotoItem, 'caption' | 'rotation' | 'frame'> &
      Partial<Pick<CollagePhotoItem, 'crop' | 'fit' | 'orientation' | 'height'>>
  ) => void;
  onDelete: () => void;
}

/** value used to encode "inherit the global frame setting" in the select */
const INHERIT = 'inherit';
/** value used to encode "fill the box", the default fit, in the select */
const FILL = 'fill';

/**
 * Height that shows the whole cropped region at the item's current width.
 * Without it the canvas box keeps its old shape and object-fit: cover would
 * trim part of the region the user just selected. The crop is measured on the
 * oriented picture, so a quarter turn swaps the source's own dimensions first.
 */
const heightForCrop = (
  width: number,
  natural: { width: number; height: number },
  crop?: CollageCrop,
  orientation?: number
): number | undefined => {
  const turned = isQuarterTurned(orientation);
  const naturalWidth = turned ? natural.height : natural.width;
  const naturalHeight = turned ? natural.width : natural.height;
  const regionWidth = (crop?.width ?? 1) * naturalWidth;
  const regionHeight = (crop?.height ?? 1) * naturalHeight;
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
  // A phone: the whole screen, with room for the keyboard.
  const fullScreen = useMediaQuery(useTheme().breakpoints.down('sm'));
  // Not on a touch screen: the keyboard would come up over the crop area
  // before anyone has decided to write a caption.
  const finePointer = useMediaQuery('(pointer: fine)');
  const [caption, setCaption] = useState('');
  const [rotation, setRotation] = useState(0);
  const [frame, setFrame] = useState<string>(INHERIT);
  const [crop, setCrop] = useState<CollageCrop | undefined>(undefined);
  const [fit, setFit] = useState<PhotoFit | undefined>(undefined);
  const [orientation, setOrientation] = useState<number | undefined>(undefined);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (photo) {
      setCaption(photo.caption);
      setRotation(photo.rotation);
      setFrame(photo.frame === undefined ? INHERIT : photo.frame ? 'on' : 'off');
      setCrop(photo.crop);
      setFit(photo.fit);
      setOrientation(photo.orientation);
    }
  }, [photo]);

  /**
   * Turns the picture a quarter at a time, carrying any crop along with it so
   * the selection keeps framing the same part of the photo instead of jumping
   * to a different corner every time the user rotates.
   */
  const turnBy = (turns: number) => {
    setOrientation(normalizeOrientation(orientationTurns(orientation) * 90 + turns * 90));
    setCrop((current) => rotateCropClockwise(current, turns));
  };

  const handleSave = () => {
    const nextCrop = normalizeCrop(crop);
    const changed =
      JSON.stringify(nextCrop ?? null) !== JSON.stringify(photo?.crop ?? null) ||
      orientationTurns(orientation) !== orientationTurns(photo?.orientation);
    // Reshape the box to the crop only when the crop or orientation actually
    // changed, so editing just a caption never moves the photo on the canvas.
    // A whole photo keeps its box: fitting inside it is the point.
    const height =
      changed && photo && naturalSize && !fit
        ? heightForCrop(photo.width, naturalSize, nextCrop, orientation)
        : undefined;

    onSave({
      caption: caption.trim(),
      rotation,
      frame: frame === INHERIT ? undefined : frame === 'on',
      crop: nextCrop,
      fit,
      orientation: normalizeOrientation(orientation),
      ...(height ? { height } : {})
    });
    onClose();
  };

  return (
    <Dialog open={open} fullScreen={fullScreen} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit photo</DialogTitle>
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
                orientation={orientation}
                crop={fit ? undefined : crop}
                onChange={fit ? () => undefined : setCrop}
                onNaturalSize={setNaturalSize}
              />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <Tooltip title="Rotate left">
                <Button
                  size="small"
                  variant="outlined"
                  aria-label="Rotate left"
                  onClick={() => turnBy(-1)}
                  sx={{ minWidth: 40 }}
                >
                  <Rotate90DegreesCcwIcon fontSize="small" />
                </Button>
              </Tooltip>
              <Tooltip title="Rotate right">
                <Button
                  size="small"
                  variant="outlined"
                  aria-label="Rotate right"
                  onClick={() => turnBy(1)}
                  sx={{ minWidth: 40 }}
                >
                  <Rotate90DegreesCwIcon fontSize="small" />
                </Button>
              </Tooltip>
              <Typography variant="caption" sx={{ color: 'text.secondary', flex: 1 }}>
                {orientation ? `Turned ${orientation}°` : 'Upright'}
              </Typography>
              <Button size="small" onClick={() => turnBy(-orientationTurns(orientation))} disabled={!orientation}>
                Reset
              </Button>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, mb: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', flex: 1 }}>
                {fit
                  ? 'Showing the whole photo'
                  : crop
                    ? `Showing ${Math.round(crop.width * 100)}% × ${Math.round(crop.height * 100)}% of the photo`
                    : 'Drag on the photo to crop it'}
              </Typography>
              <Button size="small" onClick={() => setCrop(undefined)} disabled={!crop || !!fit}>
                Clear crop
              </Button>
            </Box>
          </>
        )}
        <TextField
          autoFocus={finePointer}
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
          label="Fit"
          fullWidth
          margin="dense"
          value={fit ?? FILL}
          onChange={(e) => setFit(e.target.value === 'contain' ? 'contain' : undefined)}
        >
          <MenuItem value={FILL}>Fill the box, cropping the edges</MenuItem>
          <MenuItem value="contain">Show the whole photo</MenuItem>
        </TextField>
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
        <Button
          onClick={() => {
            onDelete();
            onClose();
          }}
          color="error"
        >
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
