import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box } from '@mui/material';
import { Warning } from '@mui/icons-material';

type Severity = 'warning' | 'error' | 'info';

export interface ConfirmationModalProps {
  open: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  /** An empty string leaves the cancel button out. */
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  severity?: Severity;
}

const ICON_COLOR: Record<Severity, string> = { error: 'error.main', warning: 'warning.main', info: 'info.main' };
const BUTTON_COLOR: Record<Severity, 'error' | 'warning' | 'primary'> = {
  error: 'error',
  warning: 'warning',
  info: 'primary'
};

/** Asks before something that cannot be taken back, such as a delete. */
export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  open,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  severity = 'warning'
}) => (
  <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
    <DialogTitle>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Warning sx={{ color: ICON_COLOR[severity], fontSize: 48 }} />
        <Typography variant="h6" component="span">
          {title}
        </Typography>
      </Box>
    </DialogTitle>
    <DialogContent>
      <Typography variant="body1" sx={{ color: 'text.secondary' }}>
        {message}
      </Typography>
    </DialogContent>
    <DialogActions sx={{ p: 3, gap: 1 }}>
      {cancelText && (
        <Button onClick={onCancel} variant="outlined" color="inherit">
          {cancelText}
        </Button>
      )}
      <Button onClick={onConfirm} variant="contained" color={BUTTON_COLOR[severity]}>
        {confirmText}
      </Button>
    </DialogActions>
  </Dialog>
);

export default ConfirmationModal;
