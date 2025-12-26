import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField
} from '@mui/material';

interface CollageTextEditorProps {
  open: boolean;
  text: string;
  onTextChange: (text: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

const CollageTextEditor: React.FC<CollageTextEditorProps> = ({
  open,
  text,
  onTextChange,
  onSave,
  onCancel,
  onDelete
}) => {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>Edit Text Box</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Text"
          fullWidth
          multiline
          minRows={2}
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onDelete} color="error">
          Delete
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
        <Button onClick={onSave} variant="contained">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CollageTextEditor;
