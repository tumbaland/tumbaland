import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Slider,
  TextField,
  Typography
} from '@mui/material';
import { CollageTextItem } from './collageDoc';

interface CollageTextDialogProps {
  open: boolean;
  text: CollageTextItem | null;
  onClose: () => void;
  onSave: (patch: Pick<CollageTextItem, 'text' | 'fontSize' | 'color'>) => void;
  onDelete: () => void;
}

const CollageTextDialog: React.FC<CollageTextDialogProps> = ({ open, text, onClose, onSave, onDelete }) => {
  const [value, setValue] = useState('');
  const [fontSize, setFontSize] = useState(32);
  const [color, setColor] = useState('#e91e63');

  useEffect(() => {
    if (text) {
      setValue(text.text);
      setFontSize(text.fontSize);
      setColor(text.color);
    }
  }, [text]);

  const handleSave = () => {
    onSave({ text: value, fontSize, color });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Edit text</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          label="Text"
          fullWidth
          multiline
          minRows={2}
          margin="dense"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Box sx={{ mt: 2, px: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }} gutterBottom>
            Size: {fontSize}px
          </Typography>
          <Slider
            value={fontSize}
            onChange={(_, v) => setFontSize(v as number)}
            min={12}
            max={120}
            valueLabelDisplay="auto"
          />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1, px: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Color
          </Typography>
          <Box
            component="input"
            type="color"
            value={color}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setColor(e.target.value)}
            sx={{
              width: 36,
              height: 28,
              p: 0,
              border: '1px solid rgba(128,128,128,0.5)',
              borderRadius: 1,
              cursor: 'pointer',
              bgcolor: 'transparent'
            }}
          />
          <Box
            component="span"
            sx={{ fontWeight: 700, fontSize: Math.min(fontSize, 28), color, ml: 1 }}
          >
            Preview
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={() => { onDelete(); onClose(); }} color="error">
          Delete
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

export default CollageTextDialog;
