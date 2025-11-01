import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Tooltip,
  FormControl,
  Paper
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import {
  getActivityTypes,
  createActivityType,
  updateActivityType,
  deleteActivityType,
  CreateActivityTypeRequest,
  UpdateActivityTypeRequest
} from '../api/activityTypes';
import { ActivityType } from '../api/types';
import GroupSelector from './GroupSelector';

interface ActivityTypesManagementProps {
  groupId?: string;
}

const ActivityTypesManagement: React.FC<ActivityTypesManagementProps> = ({ groupId }) => {
  console.log('ActivityTypesManagement rendered with groupId:', groupId);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<ActivityType | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  // Form state
  const [formData, setFormData] = useState<CreateActivityTypeRequest>({
    name: '',
    slug: '',
    description: '',
    color: '',
    groupId: groupId // Initialize with the current groupId prop
  });

  const loadActivityTypes = async () => {
    try {
      setLoading(true);
      const response = await getActivityTypes({ groupId });
      setActivityTypes(response.data);
    } catch (error: any) {
      console.error('Failed to load activity types:', error);
      alert('Failed to load activity types: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingType(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      color: '',
      groupId: groupId // Initialize with the current groupId prop
    });
    setErrors([]);
    setDialogOpen(true);
  };

  const handleEdit = (activityType: ActivityType) => {
    setEditingType(activityType);
    setFormData({
      name: activityType.name,
      slug: activityType.slug,
      description: activityType.description || '',
      color: activityType.color || '',
      groupId: activityType.groupId // Include the groupId from the activity type
    });
    setErrors([]);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this activity type?')) {
      return;
    }

    try {
      await deleteActivityType(id);
      await loadActivityTypes();
    } catch (error: any) {
      alert('Failed to delete activity type: ' + error.message);
    }
  };

  const handleSubmit = async () => {
    try {
      setErrors([]);

      // Validate required fields
      if (!formData.name.trim()) {
        setErrors(['Name is required']);
        return;
      }

      // Ensure slug is generated if not present
      if (!formData.slug?.trim()) {
        const generatedSlug = formData.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        setFormData((prev) => ({ ...prev, slug: generatedSlug }));
        return; // Let the useEffect handle the slug generation
      }

      if (editingType) {
        // Update
        console.log('Updating activity type:', editingType._id, formData);
        await updateActivityType(editingType._id, formData as UpdateActivityTypeRequest);
      } else {
        // Create
        console.log('Creating activity type with data:', formData);
        await createActivityType(formData);
      }

      console.log('Activity type operation successful, reloading...');
      setDialogOpen(false);
      await loadActivityTypes();
    } catch (error: any) {
      setErrors([error.message || 'Failed to save activity type']);
    }
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
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          overflowX: 'auto',
          maxWidth: '100%',
          '&::-webkit-scrollbar': {
            height: '6px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'rgba(0,0,0,0.1)',
            borderRadius: '3px',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0,0,0,0.3)',
            borderRadius: '3px',
            '&:hover': {
              backgroundColor: 'rgba(0,0,0,0.5)',
            },
          },
        }}
      >
        <TableContainer component={Paper}>
          <Table
            size="small"
            sx={{
              minWidth: { xs: 320, sm: 450, md: 550, lg: 650 },
              width: '100%',
              fontSize: { xs: '0.68rem', sm: '0.875rem', md: '0.9375rem', lg: '1rem' },
              '& th, & td': {
                px: { xs: 0.125, sm: 0.5, md: 1, lg: 1.5 },
                py: { xs: 0.375, sm: 0.75, md: 0.875, lg: 1 },
                fontSize: { xs: '0.68rem', sm: '0.875rem', md: '0.9375rem', lg: '1rem' },
                whiteSpace: { xs: 'nowrap', sm: 'normal' },
                maxWidth: { xs: 60, sm: 'none' },
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }
            }}
            aria-label="activity types table"
          >
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: { xs: 80, sm: 100, md: 120 }, width: { xs: 80, sm: 100, md: 120 } }}>
                <span style={{ fontSize: '0.78em' }}>Name</span>
              </TableCell>
              <TableCell sx={{ minWidth: { xs: 100, sm: 140, md: 180 }, width: { xs: 100, sm: 140, md: 180 } }}>
                <span style={{ fontSize: '0.78em' }}>Description</span>
              </TableCell>
              <TableCell sx={{ minWidth: { xs: 70, sm: 90, md: 110 }, width: { xs: 70, sm: 90, md: 110 } }}>
                <span style={{ fontSize: '0.78em' }}>Color</span>
              </TableCell>
              <TableCell align="center" sx={{ minWidth: { xs: 60, sm: 70, md: 80 }, width: { xs: 60, sm: 70, md: 80 } }}>
                <span style={{ fontSize: '0.78em' }}>Actions</span>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {activityTypes.map((type) => (
              <TableRow key={type._id}>
                <TableCell sx={{ width: { xs: 80, sm: 100, md: 120 } }}>{type.name}</TableCell>
                <TableCell sx={{ width: { xs: 100, sm: 140, md: 180 } }}>{type.description || '-'}</TableCell>
                <TableCell sx={{ width: { xs: 70, sm: 90, md: 110 } }}>
                  {type.color ? (
                    <Box display="flex" alignItems="center" gap={1}>
                      <Box
                        sx={{
                          width: { xs: 16, sm: 20 },
                          height: { xs: 16, sm: 20 },
                          borderRadius: '50%',
                          backgroundColor: type.color
                        }}
                      />
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: { xs: '0.6875rem', sm: '0.75rem' } }}>
                        {type.color}
                      </Typography>
                    </Box>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell align="center" sx={{ width: { xs: 60, sm: 70, md: 80 } }}>
                  <Box sx={{ display: 'flex', gap: { xs: 0.125, sm: 0.5 }, justifyContent: 'center' }}>
                    <Tooltip title="Edit">
                      <IconButton onClick={() => handleEdit(type)} size="small">
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
      </Box>

      {/* Create/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          {editingType ? 'Edit Activity Type' : 'Create Activity Type'}
        </DialogTitle>
        <DialogContent sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 0.5 }}>
            {errors.length > 0 && (
              <Alert severity="error" sx={{ mb: 1 }}>
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </Alert>
            )}
            <TextField
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              fullWidth
              required
              size="small"
            />
            <TextField
              label="Slug"
              value={formData.slug}
              disabled
              fullWidth
              helperText="Auto-generated from name"
              size="small"
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              fullWidth
              multiline
              rows={2}
              size="small"
            />
            <FormControl fullWidth>
              <Typography variant="body2" sx={{ mb: 0.5, color: 'text.secondary' }}>
                Color
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <input
                  type="color"
                  value={formData.color || '#FF6B6B'}
                  onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
                  style={{
                    width: '50px',
                    height: '32px',
                    border: '2px solid #ccc',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: 'none'
                  }}
                />
                {formData.color && (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {formData.color}
                  </Typography>
                )}
              </Box>
            </FormControl>
            <GroupSelector
              value={formData.groupId}
              onChange={(groupId) => setFormData((prev) => ({ ...prev, groupId }))}
              label="Share with Group"
              includePersonal={true}
              includeNone={true}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ pt: 1 }}>
          <Button onClick={() => setDialogOpen(false)} size="small">Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" size="small">
            {editingType ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ActivityTypesManagement;