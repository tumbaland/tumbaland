import React, { useState } from 'react';
import { Button } from '@mui/material';
import { Add } from '@mui/icons-material';
import { logger } from '@tumbaland/components';
import { CreateActivityRequest } from '../api/types';
import { createActivity } from '../api/activities';
import ActivityForm from './ActivityForm';

interface AddActivityModalProps {
  buttonText?: string;
  buttonProps?: React.ComponentProps<typeof Button>;
  onActivityAdded?: () => void;
}

const AddActivityModal: React.FC<AddActivityModalProps> = ({
  buttonText = 'Add Activity',
  buttonProps = {},
  onActivityAdded
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleOpenModal = () => {
    setIsFormOpen(true);
  };

  const handleCloseModal = () => {
    setIsFormOpen(false);
  };
  const handleCreateActivity = async (data: CreateActivityRequest): Promise<boolean> => {
    try {
      await createActivity(data);
      // Call the callback to refresh the data
      if (onActivityAdded) {
        onActivityAdded();
      }
      return true;
    } catch (error) {
      logger.error('Failed to create activity', error);
      // Return false so ActivityForm doesn't close the modal
      return false;
    }
  };

  return (
    <>
      <Button
        variant="contained"
        startIcon={<Add />}
        onClick={handleOpenModal}
        sx={{ 
          bgcolor: 'primary.main',
          borderRadius: 2,
          textTransform: 'none',
          fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          '&:hover': {
            bgcolor: 'primary.dark',
            boxShadow: '0 6px 16px rgba(0,0,0,0.15)',
          }
        }}
        {...buttonProps}
      >
        {buttonText}
      </Button>

      <ActivityForm
        open={isFormOpen}
        onClose={handleCloseModal}
        onSubmit={handleCreateActivity}
        title="Add New Activity"
      />
    </>
  );
};

export default AddActivityModal;
