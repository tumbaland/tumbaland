import React, { useState } from 'react';
import { IconButton, Tooltip, CircularProgress } from '@mui/material';
import { Delete } from '@mui/icons-material';
import { deleteActivity } from '../api/activities';
import ConfirmationModal from './ConfirmationModal';

interface DeleteActivityButtonProps {
  activityId: string;
  onDeleted?: () => void;
  disabled?: boolean;
}

const DeleteActivityButton: React.FC<DeleteActivityButtonProps> = ({
  activityId,
  onDeleted,
  disabled = false
}) => {  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDeleteClick = () => {
    if (isDeleting || disabled) return;
    setShowConfirmation(true);
  };
  const handleConfirmDelete = async () => {
    setShowConfirmation(false);
    setIsDeleting(true);
    setError(null);
    
    try {
      await deleteActivity(activityId);
      if (onDeleted) {
        onDeleted();
      } else {
        // Reload page if no callback provided
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to delete activity:', error);
      setError('Failed to delete activity. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setShowConfirmation(false);
  };

  const handleErrorClose = () => {
    setError(null);
  };
  return (
    <>
      <Tooltip title="Delete activity">
        <IconButton
          onClick={handleDeleteClick}
          disabled={disabled || isDeleting}
          color="error"
          size="small"
        >
          {isDeleting ? (
            <CircularProgress size={20} />
          ) : (
            <Delete fontSize="small" />
          )}
        </IconButton>
      </Tooltip>      <ConfirmationModal
        open={showConfirmation}
        title="Delete Activity"
        message="Are you sure you want to delete this activity? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        severity="error"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />      {error && (
        <ConfirmationModal
          open={!!error}
          title="Error"
          message={error}
          confirmText="OK"
          cancelText=""
          severity="error"
          onConfirm={handleErrorClose}
          onCancel={handleErrorClose}
        />
      )}
    </>
  );
};

export default DeleteActivityButton;
