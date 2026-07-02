import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box } from '@mui/material';
import { Warning } from '@mui/icons-material';

interface ConfirmationModalProps {
  open: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  severity?: 'warning' | 'error' | 'info';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  open,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  severity = 'warning'
}) => {
  const getIcon = () => {
    switch (severity) {
      case 'error':
        return <Warning sx={{ color: 'error.main', fontSize: 48 }} />;
      case 'warning':
        return <Warning sx={{ color: 'warning.main', fontSize: 48 }} />;
      case 'info':
        return <Warning sx={{ color: 'info.main', fontSize: 48 }} />;
      default:
        return <Warning sx={{ color: 'warning.main', fontSize: 48 }} />;
    }
  };

  const getConfirmButtonColor = () => {
    switch (severity) {
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'primary';
      default:
        return 'warning';
    }
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {getIcon()}
          <Typography variant="h6" component="span">
            {title}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1" sx={{
          color: "text.secondary"
        }}>
          {message}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ p: 3, gap: 1 }}>
        {cancelText && (
          <Button onClick={onCancel} variant="outlined" color="inherit">
            {cancelText}
          </Button>
        )}
        <Button onClick={onConfirm} variant="contained" color={getConfirmButtonColor() as any}>
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmationModal;
