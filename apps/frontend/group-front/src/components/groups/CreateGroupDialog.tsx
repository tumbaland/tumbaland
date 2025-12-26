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
import { Add as AddIcon } from '@mui/icons-material';

interface CreateGroupDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: () => void;
  name: string;
  setName: (name: string) => void;
  loading: boolean;
}

const CreateGroupDialog: React.FC<CreateGroupDialogProps> = ({
  open,
  onClose,
  onCreate,
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
      PaperProps={{
        sx: { borderRadius: 3 }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <AddIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Create New Group
          </Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Give your group a descriptive name to help team members understand its purpose.
        </Typography>
        <TextField
          autoFocus
          label="Group Name"
          fullWidth
          variant="outlined"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Marketing Team, Product Development"
          onKeyPress={(e) => e.key === 'Enter' && onCreate()}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2 }}>
          Cancel
        </Button>
        <Button
          onClick={onCreate}
          variant="contained"
          disabled={!name.trim() || loading}
          sx={{
            borderRadius: 2,
            px: 3
          }}
        >
          {loading ? 'Creating...' : 'Create Group'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateGroupDialog;
