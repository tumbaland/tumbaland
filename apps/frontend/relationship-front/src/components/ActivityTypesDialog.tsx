import React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ActivityTypesManagement from './ActivityTypesManagement';

interface ActivityTypesDialogProps {
  open: boolean;
  onClose: () => void;
  groupId?: string;
  /** Fired whenever a type was created, edited or deleted while the dialog was open. */
  onChanged?: () => void;
}

/**
 * The activity-type list, edit and delete flow as a modal. It used to be a page
 * of its own behind a "Types" menu entry; managing types is a detour from
 * logging days, so it now opens from the journal instead of taking over the app.
 */
const ActivityTypesDialog: React.FC<ActivityTypesDialogProps> = ({ open, onClose, groupId, onChanged }) => (
  <Dialog
    open={open}
    onClose={onClose}
    maxWidth="md"
    fullWidth
    slotProps={{ paper: { sx: { borderRadius: 2 } } }}
  >
    <DialogTitle sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, pb: 1 }}>
      <Box sx={{ flex: 1 }}>
        <Typography variant="h6" component="span" sx={{ fontWeight: 600, display: 'block' }}>
          Activity Types
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          The activities you can log against a day
        </Typography>
      </Box>
      <IconButton onClick={onClose} size="small" aria-label="Close" sx={{ mt: 0.5 }}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </DialogTitle>
    <DialogContent>
      <ActivityTypesManagement groupId={groupId} onChanged={onChanged} />
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 2 }}>
      <Button onClick={onClose} sx={{ textTransform: 'none' }}>
        Done
      </Button>
    </DialogActions>
  </Dialog>
);

export default ActivityTypesDialog;
