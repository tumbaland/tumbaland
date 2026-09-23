import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import { TrendingUp, CreditCard } from '@mui/icons-material';
import { AssetClassKind } from '../types';
import GroupSelector from './GroupSelector';

const PREDEFINED_COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#22c55e', // Green
  '#eab308', // Yellow
  '#8b5cf6', // Purple
  '#f97316', // Orange
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#84cc16', // Lime
  '#f59e0b', // Amber
];

export interface AssetClassFormValues {
  name: string;
  description: string;
  color: string;
  kind: AssetClassKind;
  groupId?: string;
}

const AssetClassModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onSubmit: (form: AssetClassFormValues) => void;
  form: AssetClassFormValues;
  setForm: React.Dispatch<React.SetStateAction<AssetClassFormValues>>;
  title: string;
}> = ({ open, onClose, onSubmit, form, setForm, title }) => (
  <Dialog 
    open={open} 
    onClose={onClose} 
    maxWidth="sm" 
    fullWidth
    slotProps={{
      paper: {
        elevation: 0,
        sx: {
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider'
        }
      }
    }}
  >
    <DialogTitle>{title}</DialogTitle>
    <DialogContent>
      <TextField
        margin="dense"
        label="Name"
        name="name"
        type="text"
        fullWidth
        required
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <TextField
        margin="dense"
        label="Description"
        name="description"
        type="text"
        fullWidth
        multiline
        rows={3}
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        slotProps={{ inputLabel: { shrink: true } }}
      />

      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Type
        </Typography>
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={form.kind}
          onChange={(_, kind: AssetClassKind | null) => kind && setForm((f) => ({ ...f, kind }))}
        >
          <ToggleButton value="asset">
            <TrendingUp fontSize="small" sx={{ mr: 1 }} />
            Asset
          </ToggleButton>
          <ToggleButton value="liability">
            <CreditCard fontSize="small" sx={{ mr: 1 }} />
            Liability
          </ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
          {form.kind === 'liability'
            ? 'Enter what you owe as a positive number — it is subtracted from net worth.'
            : 'Adds to net worth.'}
        </Typography>
      </Box>

      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Default Color (for charts)
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
          {PREDEFINED_COLORS.map((color) => (
            <Box
              key={color}
              sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: color,
                cursor: 'pointer',
                border: form.color === color ? '3px solid var(--mui-palette-text-primary)' : '2px solid var(--mui-palette-divider)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                '&:hover': {
                  border: '3px solid var(--mui-palette-text-secondary)'
                }
              }}
              onClick={() => setForm((f) => ({ ...f, color }))}
            >
              {form.color === color && (
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: 'white' }} />
              )}
            </Box>
          ))}
        </Box>
        <TextField
          margin="dense"
          label="Custom Color (hex)"
          name="color"
          type="text"
          fullWidth
          value={form.color || ''}
          onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
          placeholder="#667eea"
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ mt: 1 }}
        />
      </Box>

      <Box sx={{ mt: 2 }}>
        <GroupSelector
          value={form.groupId}
          onChange={(groupId) => setForm((f) => ({ ...f, groupId }))}
          label="Share with Group (optional)"
          includePersonal={false}
          includeNone={true}
        />
      </Box>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancel</Button>
      <Button onClick={() => onSubmit(form)} variant="contained">
        {title.includes('Edit') ? 'Update' : 'Add'}
      </Button>
    </DialogActions>
  </Dialog>
);

export default AssetClassModal;