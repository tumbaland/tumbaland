import React, { useState, useEffect } from 'react';
import { logger } from '@tumbaland/frontend-core';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  CircularProgress,
  Tooltip,
  Paper,
  Chip,
  useTheme,
  alpha
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Circle as CircleIcon
} from '@mui/icons-material';
import {
  getActivityTypes,
  createActivityType,
  updateActivityType,
  deleteActivityType,
  CreateActivityTypeRequest,
  UpdateActivityTypeRequest
} from '../services/activityTypes';
import { ActivityType } from '../services/types';
import ActivityTypeDialog from './ActivityTypeDialog';

interface ActivityTypesManagementProps {
  groupId?: string;
}

const ActivityTypesManagement: React.FC<ActivityTypesManagementProps> = ({ groupId }) => {
  const theme = useTheme();
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<ActivityType | null>(null);

  const loadActivityTypes = async () => {
    try {
      setLoading(true);
      const response = await getActivityTypes({ groupId });
      setActivityTypes(response.data);
    } catch (error) {
      logger.error('Failed to load activity types', error);
      // Ideally use a snackbar here instead of alert
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingType(null);
    setDialogOpen(true);
  };

  const handleEdit = (activityType: ActivityType) => {
    setEditingType(activityType);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this activity type?')) {
      return;
    }

    try {
      await deleteActivityType(id);
      await loadActivityTypes();
    } catch (error) {
      alert('Failed to delete activity type: ' + (error instanceof Error ? error.message : error));
    }
  };

  const handleDialogSubmit = async (data: CreateActivityTypeRequest | UpdateActivityTypeRequest) => {
    if (editingType) {
      await updateActivityType(editingType._id, data as UpdateActivityTypeRequest);
    } else {
      await createActivityType(data as CreateActivityTypeRequest);
    }
    await loadActivityTypes();
  };

  useEffect(() => {
    loadActivityTypes();
  }, [groupId]);

  useEffect(() => {
    const handleOpenCreateDialog = () => {
      handleCreate();
    };

    window.addEventListener('openCreateActivityTypeDialog', handleOpenCreateDialog);

    return () => {
      window.removeEventListener('openCreateActivityTypeDialog', handleOpenCreateDialog);
    };
  }, []);

  if (loading && activityTypes.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          p: 8
        }}>
        <CircularProgress />
      </Box>
    );
  }

  if (activityTypes.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          p: 8,
          bgcolor: 'background.paper',
          borderRadius: 2,
          border: '1px dashed',
          borderColor: 'divider'
        }}>
        <Typography variant="h6" gutterBottom sx={{
          color: "text.secondary"
        }}>
          No Activity Types Found
        </Typography>
        <Typography variant="body2" sx={{
          color: "text.secondary"
        }}>
          Create your first activity type to get started.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <TableContainer 
        component={Paper} 
        elevation={0} 
        sx={{ 
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          overflowX: 'auto',
          width: '100%'
        }}
      >
        <Table sx={{ width: '100%' }} aria-label="activity types table">
          <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Color</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {activityTypes.map((type) => (
              <TableRow 
                key={type._id}
                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                hover
              >
                <TableCell component="th" scope="row">
                  <Typography variant="subtitle2" sx={{
                    fontWeight: 600
                  }}>
                    {type.name}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={type.valueType === 'boolean' ? 'Yes / No' : type.valueType === 'number' ? 'Number' : 'Text'}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.72rem' }}
                  />
                </TableCell>
                <TableCell>
                  {type.color ? (
                    <Chip
                      icon={<CircleIcon style={{ fill: type.color, fontSize: 12 }} />}
                      label={type.color}
                      size="small"
                      variant="outlined"
                      sx={{ 
                        borderColor: alpha(type.color, 0.5),
                        bgcolor: alpha(type.color, 0.05),
                        fontFamily: 'monospace'
                      }}
                    />
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell align="right">
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                    <Tooltip title="Edit">
                      <IconButton onClick={() => handleEdit(type)} size="small" color="primary">
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        onClick={() => handleDelete(type._id)}
                        size="small"
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <ActivityTypeDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleDialogSubmit}
        initialData={editingType}
        defaultGroupId={groupId}
      />
    </Box>
  );
};

export default ActivityTypesManagement;
