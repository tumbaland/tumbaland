import React, { useState } from 'react';
import { IconButton, alpha } from '@mui/material';
import { Edit } from '@mui/icons-material';
import { Activity, UpdateActivityRequest } from '../api/types';
import { updateActivity } from '../api/activities';
import ActivityForm from './ActivityForm';

interface EditActivityModalProps {
  activity: Activity;
  buttonProps?: React.ComponentProps<typeof IconButton>;
  onActivityUpdated?: () => void;
}

const EditActivityModal: React.FC<EditActivityModalProps> = ({ activity, buttonProps = {}, onActivityUpdated }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleOpenModal = () => {
    setIsFormOpen(true);
  };

  const handleCloseModal = () => {
    setIsFormOpen(false);
  };

  const handleEditActivity = async (data: UpdateActivityRequest): Promise<boolean> => {
    try {
      const activityId = activity._id || activity.id || '';
      if (!activityId) throw new Error('Activity ID is missing');
      await updateActivity(activityId, data);
      if (onActivityUpdated) {
        onActivityUpdated();
      }
      return true;
    } catch (error) {
      console.error('Failed to update activity:', error);
      return false;
    }
  };

  return (
    <>
      <IconButton 
        color="primary" 
        onClick={handleOpenModal} 
        size="small" 
        {...buttonProps} 
        aria-label="Edit Activity"
        sx={{
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
          '&:hover': {
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.2),
          },
          ...buttonProps.sx
        }}
      >
        <Edit fontSize="small" />
      </IconButton>
      <ActivityForm
        open={isFormOpen}
        onClose={handleCloseModal}
        onSubmit={handleEditActivity}
        activity={activity}
        title="Edit Activity"
      />
    </>
  );
};

export default EditActivityModal;
