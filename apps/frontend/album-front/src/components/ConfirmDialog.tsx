import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, IconButton } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'warning' | 'danger' | 'info';
  loading?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning',
  loading = false
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          iconColor: 'error.main',
          iconBgColor: 'error.light',
          confirmButtonColor: 'error' as const
        };
      case 'warning':
        return {
          iconColor: 'warning.main',
          iconBgColor: 'warning.light',
          confirmButtonColor: 'warning' as const
        };
      case 'info':
        return {
          iconColor: 'info.main',
          iconBgColor: 'info.light',
          confirmButtonColor: 'primary' as const
        };
      default:
        return {
          iconColor: 'warning.main',
          iconBgColor: 'warning.light',
          confirmButtonColor: 'warning' as const
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          p: 1
        }
      }}
    >
      <Box sx={{ position: 'relative' }}>
        <IconButton
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: 'grey.500',
            zIndex: 1
          }}
          disabled={loading}
        >
          <CloseIcon />
        </IconButton>

        <DialogTitle sx={{ textAlign: 'center', pt: 3, pb: 2 }}>
          <Typography fontWeight="600">{title}</Typography>
        </DialogTitle>

        <DialogContent sx={{ textAlign: 'center', pt: 0, pb: 2 }}>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            {message}
          </Typography>
        </DialogContent>

        <DialogActions sx={{ justifyContent: 'center', gap: 2, pb: 3, px: 3 }}>
          <Button onClick={onClose} variant="outlined" size="large" disabled={loading} sx={{ minWidth: 100 }}>
            {cancelText}
          </Button>
          <Button
            onClick={onConfirm}
            variant="contained"
            color={styles.confirmButtonColor}
            size="large"
            disabled={loading}
            sx={{ minWidth: 100 }}
          >
            {loading ? 'Processing...' : confirmText}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

export default ConfirmDialog;
