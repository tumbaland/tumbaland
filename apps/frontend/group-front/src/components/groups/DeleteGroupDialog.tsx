import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Stack,
  Alert
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { Group } from '../../types';

interface DeleteGroupDialogProps {
  open: boolean;
  onClose: () => void;
  onDelete: () => void;
  group: Group | null;
  loading: boolean;
}

const DeleteGroupDialog: React.FC<DeleteGroupDialogProps> = ({
  open,
  onClose,
  onDelete,
  group,
  loading
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      PaperProps={{
        sx: { borderRadius: 3 }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <DeleteIcon color="error" />
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'error.main' }}>
            Delete Group
          </Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>
          Are you sure you want to delete <strong>"{group?.name}"</strong>?
        </Typography>
        <Alert severity="warning" sx={{ mb: 2 }}>
          This action cannot be undone. The group will be permanently deleted.
        </Alert>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2 }}>
          Cancel
        </Button>
        <Button
          onClick={onDelete}
          variant="contained"
          color="error"
          disabled={loading}
          sx={{ borderRadius: 2, px: 3 }}
        >
          {loading ? 'Deleting...' : 'Delete Group'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteGroupDialog;
