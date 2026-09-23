import React, { useState, useEffect } from 'react';
import { logger, useActivePalette } from '@tumbaland/frontend-core';
import {
  Box,
  Button,
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
  useMediaQuery,
  alpha
} from '@mui/material';
import {
  Add as AddIcon,
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
  /** Called after a type is created, updated or deleted, so callers can refresh their own copy. */
  onChanged?: () => void;
}

const ActivityTypesManagement: React.FC<ActivityTypesManagementProps> = ({ groupId, onChanged }) => {
  const theme = useTheme();
  const palette = useActivePalette();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
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
      onChanged?.();
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
    onChanged?.();
  };

  useEffect(() => {
    loadActivityTypes();
  }, [groupId]);

  const addButton = (
    <Button
      variant="contained"
      startIcon={<AddIcon />}
      onClick={handleCreate}
      sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
    >
      Add Activity Type
    </Button>
  );

  const dialog = (
    <ActivityTypeDialog
      open={dialogOpen}
      onClose={() => setDialogOpen(false)}
      onSubmit={handleDialogSubmit}
      initialData={editingType}
      defaultGroupId={groupId}
    />
  );

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
          gap: 2,
          p: 6,
          bgcolor: 'background.paper',
          borderRadius: 2,
          border: '1px dashed',
          borderColor: 'divider'
        }}>
        <Box sx={{ textAlign: 'center' }}>
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
        {addButton}
        {dialog}
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>{addButton}</Box>
      {isMobile ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {activityTypes.map((type) => (
            <Paper
              key={type._id}
              elevation={0}
              sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {type.name}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                  <Tooltip title="Edit">
                    <IconButton onClick={() => handleEdit(type)} size="small" color="primary">
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton onClick={() => handleDelete(type._id)} size="small" color="error">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                <Chip
                  label={type.valueType === 'boolean' ? 'Yes / No' : type.valueType === 'number' ? 'Number' : 'Text'}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.72rem' }}
                />
                {type.color && (
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
                )}
              </Box>
            </Paper>
          ))}
        </Box>
      ) : (
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
            <TableHead sx={{ bgcolor: alpha(palette.primary.main, 0.04) }}>
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
      )}
      {dialog}
    </Box>
  );
};

export default ActivityTypesManagement;
