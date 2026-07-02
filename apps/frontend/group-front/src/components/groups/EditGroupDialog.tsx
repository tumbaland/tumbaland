import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Stack
} from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';

interface EditGroupDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  name: string;
  setName: (name: string) => void;
  loading: boolean;
}

const EditGroupDialog: React.FC<EditGroupDialogProps> = ({
  open,
  onClose,
  onSave,
  name,
  setName,
  loading
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: { borderRadius: 3 }
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1} sx={{
          alignItems: "center"
        }}>
          <EditIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Edit Group
          </Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          label="Group Name"
          fullWidth
          variant="outlined"
          value={name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && onSave()}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2 }}>
          Cancel
        </Button>
        <Button
          onClick={onSave}
          variant="contained"
          disabled={!name.trim() || loading}
          sx={{
            borderRadius: 2,
            px: 3
          }}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditGroupDialog;
