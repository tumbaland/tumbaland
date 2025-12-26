import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  Alert,
  CircularProgress,
  Typography,
  FormControl
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { Activity, ActivityType, CreateActivityRequest } from '../api/types';
import { getActivityTypes, createActivityType } from '../api/activityTypes';
import { formatDateForInput, validateActivity } from '../utils/activityUtils';
import GroupSelector from './GroupSelector';
import { useTenantFilter } from './tenant';

interface ActivityFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateActivityRequest) => Promise<boolean>;
  activity?: Activity | null;
  title?: string;
}

const ActivityForm: React.FC<ActivityFormProps> = ({ open, onClose, onSubmit, activity, title }) => {
  const [activityTypes, setActivityTypes] = useState<ActivityType[] | null>(null);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [showCreateType, setShowCreateType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeSlug, setNewTypeSlug] = useState('');
  const [newTypeDescription, setNewTypeDescription] = useState('');
  const [newTypeColor, setNewTypeColor] = useState('#FF6B6B');
  const [creatingType, setCreatingType] = useState(false);

  // Get current tenant context for prefill
  const currentGroupId = useTenantFilter();

  // Form state
  const [formData, setFormData] = useState<{
    date: string;
    hours: string | number | null;
    activityTypeId: string;
    description: string;
    groupId: string | undefined;
  }>({
    date: '',
    hours: null,
    activityTypeId: '',
    description: '',
    groupId: undefined
  });

  // Load activity types when dialog opens and when group context changes
  useEffect(() => {
    if (open) {
      loadActivityTypes();
    }
  }, [open, currentGroupId]);

  // Initialize form data when dialog opens or activity changes
  useEffect(() => {
    if (open && activityTypes !== null) {
      if (activity) {
        // Edit mode - populate with existing data
        const typeId = typeof activity.activity.typeId === 'string' 
          ? activity.activity.typeId 
          : (activity.activity.typeId?._id || '');
        
        // Check if the type still exists in the loaded types
        const typeExists = activityTypes.some(type => type._id === typeId);
        
        setFormData({
          date: formatDateForInput(activity.date),
          hours: activity.hours || null,
          activityTypeId: typeExists ? typeId : '',
          description: activity.activity.description || '',
          groupId: (activity as any).groupId
        });
      } else {
        // Create mode - set defaults
        setFormData({
          date: formatDateForInput(new Date()),
          hours: null,
          activityTypeId: '',
          description: '',
          groupId: currentGroupId // Prefill with current group context
        });
      }
      setErrors([]);
    }
  }, [activity, open, activityTypes, currentGroupId]);

  // Auto-generate slug from name for new activity type
  useEffect(() => {
    if (newTypeName && showCreateType) {
      const generatedSlug = newTypeName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      setNewTypeSlug(generatedSlug);
    }
  }, [newTypeName, showCreateType]);

  const loadActivityTypes = async () => {
    try {
      setLoadingTypes(true);
      console.log('Loading activity types for groupId:', currentGroupId);
      const response = await getActivityTypes({ groupId: currentGroupId });
      setActivityTypes(response.data);
      console.log('Loaded activity types:', response.data);
    } catch (error) {
      console.error('Failed to load activity types:', error);
      setErrors(['Failed to load activity types']);
      setActivityTypes([]); // Set empty array to prevent undefined errors
    } finally {
      setLoadingTypes(false);
    }
  };

  const handleCreateActivityType = async () => {
    if (!newTypeName.trim()) return;

    try {
      setCreatingType(true);
      const newType = await createActivityType({
        name: newTypeName.trim(),
        slug: newTypeSlug.trim(),
        description: newTypeDescription.trim() || undefined,
        color: newTypeColor,
        groupId: currentGroupId // Use current tenant context
      });

      // Add the new type to the list
      setActivityTypes(prev => prev ? [...prev, newType] : [newType]);

      // Select the newly created type
      setFormData(prev => ({ ...prev, activityTypeId: newType._id }));

      // Reset create type form
      setNewTypeName('');
      setNewTypeSlug('');
      setNewTypeDescription('');
      setNewTypeColor('#FF6B6B');
      setShowCreateType(false);
    } catch (error: any) {
      console.error('Failed to create activity type:', error);
      setErrors([error.message || 'Failed to create activity type']);
    } finally {
      setCreatingType(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const hoursValue = formData.hours === null ? 0 : Number(formData.hours);

    const activityData: CreateActivityRequest = {
      date: formData.date,
      ...((hoursValue > 0 || isEditMode) && { hours: hoursValue }),
      activity: {
        typeId: formData.activityTypeId,
        ...(formData.description.trim() && {
          description: formData.description.trim()
        })
      },
      ...(formData.groupId && { groupId: formData.groupId })
    };

    // Validate
    const validationErrors = validateActivity(activityData);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    setErrors([]);

    try {
      const success = await onSubmit(activityData);
      if (success) {
        onClose();
      }
    } catch (error: any) {
      setErrors([error.message || 'Failed to save activity']);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const isEditMode = !!activity;

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
            overflow: 'hidden'
          }
        }}
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 600 }}>
          {title || (isEditMode ? 'Edit Activity' : 'Add New Activity')}
        </DialogTitle>

        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
              {errors.length > 0 && (
                <Alert severity="error" sx={{ borderRadius: 2 }}>
                  <ul style={{ margin: 0, paddingLeft: '20px' }}>
                    {errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </Alert>
              )}
              {(activityTypes || []).length === 0 && !loadingTypes && (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  No activity types available. Create your first activity type below.
                </Alert>
              )}
              
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, date: e.target.value }));
                  }}
                  fullWidth
                  required
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="Duration (hours)"
                  type="number"
                  value={formData.hours === null ? '' : String(formData.hours)}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      hours: e.target.value === '' ? null : Number(e.target.value) || null
                    }))
                  }
                  fullWidth
                  placeholder="Optional"
                />
              </Box>

              <TextField
                label="Activity Type"
                select
                value={activityTypes ? formData.activityTypeId : ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    activityTypeId: e.target.value
                  }))
                }
                fullWidth
                required
                disabled={loadingTypes}
                SelectProps={{
                  MenuProps: { PaperProps: { sx: { maxHeight: 300, borderRadius: 2 } } }
                }}
              >
                {(activityTypes || []).map((type) => (
                  <MenuItem key={type._id} value={type._id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box 
                        sx={{ 
                          width: 12, 
                          height: 12, 
                          borderRadius: '50%', 
                          bgcolor: type.color || '#ccc' 
                        }} 
                      />
                      {type.name}
                    </Box>
                  </MenuItem>
                ))}
                {!loadingTypes && (
                  <MenuItem 
                    onClick={() => setShowCreateType(true)}
                    sx={{ 
                      borderTop: '1px solid', 
                      borderColor: 'divider',
                      color: 'primary.main',
                      fontWeight: 500,
                      mt: 1
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AddIcon fontSize="small" />
                      Create new activity type
                    </Box>
                  </MenuItem>
                )}
              </TextField>

              <TextField
                label="Description"
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                fullWidth
                placeholder="Optional details about the activity..."
                inputProps={{ maxLength: 500 }}
                helperText={`${formData.description.length}/500 characters`}
              />

              <GroupSelector
                value={formData.groupId}
                onChange={(groupId) => setFormData((prev) => ({ ...prev, groupId }))}
                label="Share with Group (optional)"
                includePersonal={false}
                includeNone={true}
              />
            </Box>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={handleClose} disabled={loading} color="inherit">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loading || loadingTypes}
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
              sx={{ px: 3 }}
            >
              {loading ? 'Saving...' : isEditMode ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Create Activity Type Dialog */}
      <Dialog
        open={showCreateType}
        onClose={() => !creatingType && setShowCreateType(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
            overflow: 'hidden'
          }
        }}
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 600 }}>Create New Activity Type</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Name"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              fullWidth
              required
              disabled={creatingType}
              autoFocus
            />
            
            <TextField
              label="Description"
              value={newTypeDescription}
              onChange={(e) => setNewTypeDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
              disabled={creatingType}
              placeholder="Optional description"
            />
            
            <FormControl fullWidth>
              <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                Color Label
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  component="input"
                  type="color"
                  value={newTypeColor}
                  onChange={(e) => setNewTypeColor(e.target.value)}
                  disabled={creatingType}
                  sx={{
                    width: 60,
                    height: 40,
                    p: 0,
                    border: 'none',
                    borderRadius: 1,
                    cursor: 'pointer',
                    '&::-webkit-color-swatch-wrapper': { p: 0 },
                    '&::-webkit-color-swatch': { border: 'none', borderRadius: 4 }
                  }}
                />
                <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                  {newTypeColor}
                </Typography>
              </Box>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={() => setShowCreateType(false)}
            disabled={creatingType}
            color="inherit"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateActivityType}
            variant="contained"
            disabled={creatingType || !newTypeName.trim()}
            startIcon={creatingType ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {creatingType ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ActivityForm;
