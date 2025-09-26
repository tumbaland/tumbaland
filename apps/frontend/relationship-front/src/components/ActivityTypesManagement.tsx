import React, { useState, useEffect } from 'react';
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
  Chip,
  Tooltip,
  FormControl,
  Paper
} from '@mui/material';
import {
  Add as AddIcon,
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

  // Auto-generate slug from name
  useEffect(() => {
    if (formData.name && !editingType) {
      const generatedSlug = formData.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      setFormData((prev) => ({ ...prev, slug: generatedSlug }));
    }
  }, [formData.name, editingType]);

  // Load activity types when component mounts or groupId changes
  useEffect(() => {
    loadActivityTypes();
  }, [groupId]);

  // Also load on component mount (in case groupId doesn't change but component remounts)
  useEffect(() => {
    loadActivityTypes();
  }, []);

  const loadActivityTypes = async () => {
    try {
      setLoading(true);
      console.log('Loading activity types with groupId:', groupId);
      const response = await getActivityTypes({ groupId });
      console.log('Activity types response:', response);
      setActivityTypes(response.data);
    } catch (error) {
      console.error('Failed to load activity types:', error);
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
      groupId: groupId // Use the current groupId prop
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

  if (loading && activityTypes.length === 0) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" component="h2">
          Activity Types Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreate}
          size="small"
        >
          Add Activity Type
        </Button>
      </Box>
      <Box sx={{ overflowX: 'auto', maxWidth: '100%' }}>
        <TableContainer component={Paper}>
          <Table size="small" sx={{ minWidth: 600 }} aria-label="activity types table">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Slug</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Color</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {activityTypes.map((type) => (
              <TableRow key={type._id}>
                <TableCell>{type.name}</TableCell>
                <TableCell>{type.slug}</TableCell>
                <TableCell>{type.description || '-'}</TableCell>
                <TableCell>
                  {type.color ? (
                    <Box display="flex" alignItems="center" gap={1}>
                      <Box
                        sx={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          backgroundColor: type.color
                        }}
                      />
                      {type.color}
                    </Box>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    label={type.isActive ? 'Active' : 'Inactive'}
                    color={type.isActive ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Tooltip title="Edit">
                    <IconButton onClick={() => handleEdit(type)} size="small">
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton
                      onClick={() => handleDelete(type._id)}
                      size="small"
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
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