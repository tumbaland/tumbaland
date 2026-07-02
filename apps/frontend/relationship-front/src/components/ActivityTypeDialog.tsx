import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  Box,
  Typography,
  FormControl,
  CircularProgress,
  MenuItem
} from '@mui/material';
import { ActivityType } from '../api/types';
import { CreateActivityTypeRequest, UpdateActivityTypeRequest } from '../api/activityTypes';
import GroupSelector from './GroupSelector';

interface ActivityTypeDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateActivityTypeRequest | UpdateActivityTypeRequest) => Promise<void>;
  initialData?: ActivityType | null;
  defaultGroupId?: string;
}

const ActivityTypeDialog: React.FC<ActivityTypeDialogProps> = ({
  open,
  onClose,
  onSubmit,
  initialData,
  defaultGroupId
}) => {
  const [formData, setFormData] = useState<CreateActivityTypeRequest>({
    name: '',
    slug: '',
    description: '',
    color: '#FF6B6B',
    valueType: 'string',
    groupId: defaultGroupId
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (initialData) {
        setFormData({
          name: initialData.name,
          slug: initialData.slug,
          description: initialData.description || '',
          color: initialData.color || '#FF6B6B',
          valueType: initialData.valueType || 'string',
          groupId: initialData.groupId
        });
      } else {
        setFormData({
          name: '',
          slug: '',
          description: '',
          color: '#FF6B6B',
          valueType: 'string',
          groupId: defaultGroupId
        });
      }
      setErrors([]);
    }
  }, [open, initialData, defaultGroupId]);

  const handleSubmit = async () => {
    setErrors([]);
    
    if (!formData.name.trim()) {
      setErrors(['Name is required']);
      return;
    }

    // Generate slug if missing
    let dataToSubmit = { ...formData };
    if (!dataToSubmit.slug?.trim()) {
      dataToSubmit.slug = dataToSubmit.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    }

    try {
      setSubmitting(true);
      await onSubmit(dataToSubmit);
      onClose();
    } catch (error: any) {
      setErrors([error.message || 'Failed to save activity type']);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm" 
      fullWidth
      slotProps={{
        paper: {
          sx: { borderRadius: 2 }
        }
      }}
    >
      <DialogTitle sx={{ pb: 1, fontWeight: 600 }}>
        {initialData ? 'Edit Activity Type' : 'Create Activity Type'}
      </DialogTitle>
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
          
          <TextField
            label="Name"
            value={formData.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            fullWidth
            required
            autoFocus
          />

          <TextField
            label="Value type"
            select
            value={formData.valueType || 'string'}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData((prev) => ({ ...prev, valueType: e.target.value as 'string' | 'boolean' | 'number' }))}
            fullWidth
            helperText="Controls how the description is captured when logging this activity"
          >
            <MenuItem value="string">Text — free text or pick from past entries</MenuItem>
            <MenuItem value="boolean">Yes / No — simple checkbox</MenuItem>
            <MenuItem value="number">Number — numeric value (e.g. km, pages, reps)</MenuItem>
          </TextField>

          <TextField
            label="Slug"
            value={formData.slug}
            disabled
            fullWidth
            helperText="Auto-generated from name"
            size="small"
            sx={{ display: 'none' }} // Hidden as it's auto-generated, but kept in state
          />
          
          <TextField
            label="Description"
            value={formData.description}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            fullWidth
            multiline
            rows={3}
            placeholder="Optional description"
          />
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl fullWidth>
              <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                Color Label
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  component="input"
                  type="color"
                  value={formData.color}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
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
                  {formData.color}
                </Typography>
              </Box>
            </FormControl>

            <Box sx={{ width: '100%' }}>
               <GroupSelector
                value={formData.groupId}
                onChange={(groupId) => setFormData((prev) => ({ ...prev, groupId }))}
                label="Share with Group"
                includePersonal={true}
                includeNone={true}
              />
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={submitting} color="inherit">
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disabled={submitting}
          startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : null}
          sx={{ px: 3 }}
        >
          {submitting ? 'Saving...' : (initialData ? 'Update' : 'Create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ActivityTypeDialog;
