import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography
} from '@mui/material';
import { ActivityType } from '../services/types';
import { DashboardSettingsData } from '../services/dashboardSettings';

interface DashboardCustomizeDialogProps {
  open: boolean;
  types: ActivityType[];
  settings: DashboardSettingsData;
  onClose: () => void;
  onSave: (settings: DashboardSettingsData) => Promise<void>;
}

const TypeChipRow: React.FC<{
  types: ActivityType[];
  selected: string[];
  onToggle: (typeId: string) => void;
}> = ({ types, selected, onToggle }) => (
  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
    {types.map((type) => {
      const active = selected.includes(type._id);
      return (
        <Chip
          key={type._id}
          label={type.name}
          onClick={() => onToggle(type._id)}
          variant={active ? 'filled' : 'outlined'}
          sx={{
            bgcolor: active ? type.color || 'primary.main' : 'transparent',
            color: active ? '#fff' : 'text.primary',
            borderColor: type.color || 'divider',
            fontWeight: active ? 600 : 400,
            '&:hover': { bgcolor: active ? type.color || 'primary.main' : 'action.hover' }
          }}
        />
      );
    })}
  </Box>
);

/**
 * Pick which activity types the dashboard features and which it hides.
 * Highlights get a stat card each; the first highlight also drives the
 * monthly days-breakdown chart. Hidden types are excluded from count charts.
 */
const DashboardCustomizeDialog: React.FC<DashboardCustomizeDialogProps> = ({
  open,
  types,
  settings,
  onClose,
  onSave
}) => {
  const [highlights, setHighlights] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setHighlights(settings.highlightTypeIds);
      setHidden(settings.hiddenTypeIds);
      setStartDate(settings.startDate || '');
      setError(null);
    }
  }, [open, settings]);

  const toggle = (list: string[], setList: (v: string[]) => void) => (typeId: string) => {
    setList(list.includes(typeId) ? list.filter((id) => id !== typeId) : [...list, typeId]);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave({ highlightTypeIds: highlights, hiddenTypeIds: hidden, startDate: startDate || null });
      onClose();
    } catch {
      setError('Failed to save dashboard settings');
    } finally {
      setSaving(false);
    }
  };

  const highlightedNames = highlights
    .map((id) => types.find((t) => t._id === id)?.name)
    .filter(Boolean);

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>Customize dashboard</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Typography variant="subtitle2" sx={{ mt: 1 }}>
          Together since
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
          The day the "Days" card counts from. Leave it empty to count from the first
          entry you logged.
        </Typography>
        <TextField
          type="date"
          size="small"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          slotProps={{
            htmlInput: { max: new Date().toISOString().slice(0, 10), 'aria-label': 'Together since' }
          }}
        />

        {types.length === 0 ? (
          <Alert severity="info" sx={{ mt: 3 }}>Create some activity types first.</Alert>
        ) : (
          <>
            <Typography variant="subtitle2" sx={{ mt: 3 }}>
              Highlighted activities
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
              Each gets its own stat card counting the days it happened.
              {highlightedNames.length > 0 &&
                ` The days chart features "${highlightedNames[0]}" as its own color.`}
            </Typography>
            <TypeChipRow types={types} selected={highlights} onToggle={toggle(highlights, setHighlights)} />

            <Typography variant="subtitle2" sx={{ mt: 3 }}>
              Hidden from charts
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
              Excluded from activity counts in the monthly chart and heatmap — useful for
              everyday markers that would drown out the rest.
            </Typography>
            <TypeChipRow types={types} selected={hidden} onToggle={toggle(hidden, setHidden)} />
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={saving} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving}
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : null}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DashboardCustomizeDialog;
