import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Alert,
  Chip,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { AssetClass, SnapshotEntry } from '../../types';
import { parseNumericInput, formatCurrency } from '../../utils/numberUtils';

interface EntryFormValue {
  value: string;
  gain: string;
}

interface CheckInDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (month: string, entries: SnapshotEntry[]) => Promise<void>;
  assetClasses: AssetClass[];
  /** Month being edited (YYYY-MM); when set the month field is locked */
  editMonth?: string;
  /** Prefill values: existing snapshot when editing, latest snapshot when creating */
  initialEntries: Map<string, { value: number; gain: number }>;
  defaultMonth: string;
  saving: boolean;
}

/**
 * The monthly check-in: enter the current value of every asset class for one
 * month in a single form. Empty rows are left out of the snapshot.
 */
const CheckInDialog: React.FC<CheckInDialogProps> = ({
  open,
  onClose,
  onSubmit,
  assetClasses,
  editMonth,
  initialEntries,
  defaultMonth,
  saving
}) => {
  const [month, setMonth] = useState(defaultMonth);
  const [form, setForm] = useState<Map<string, EntryFormValue>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    if (!open) return;
    setMonth(editMonth || defaultMonth);
    setError(null);
    const next = new Map<string, EntryFormValue>();
    assetClasses.forEach((ac) => {
      const initial = initialEntries.get(ac._id);
      next.set(ac._id, {
        value: initial !== undefined ? String(initial.value) : '',
        gain: initial !== undefined && initial.gain !== 0 ? String(initial.gain) : ''
      });
    });
    setForm(next);
  }, [open, editMonth, defaultMonth, assetClasses, initialEntries]);

  const setField = (assetClassId: string, field: keyof EntryFormValue, value: string) => {
    setForm((prev) => {
      const next = new Map(prev);
      next.set(assetClassId, { ...(next.get(assetClassId) || { value: '', gain: '' }), [field]: value });
      return next;
    });
  };

  const entries = useMemo(() => {
    const result: SnapshotEntry[] = [];
    form.forEach((v, assetClassId) => {
      const value = parseNumericInput(v.value);
      if (!isNaN(value)) {
        const gain = parseNumericInput(v.gain);
        result.push({ assetClassId, value, gain: isNaN(gain) ? 0 : gain });
      }
    });
    return result;
  }, [form]);

  const kindOf = useMemo(
    () => new Map(assetClasses.map((ac) => [ac._id, ac.kind || 'asset'])),
    [assetClasses]
  );

  // Liability values are entered as positive magnitudes and subtracted here,
  // so the running total shown while typing is the real net worth.
  const { assets, liabilities } = useMemo(
    () =>
      entries.reduce(
        (acc, e) => {
          if (kindOf.get(e.assetClassId) === 'liability') acc.liabilities += e.value;
          else acc.assets += e.value;
          return acc;
        },
        { assets: 0, liabilities: 0 }
      ),
    [entries, kindOf]
  );
  const total = assets - liabilities;

  const assetRows = assetClasses.filter((ac) => (ac.kind || 'asset') === 'asset');
  const liabilityRows = assetClasses.filter((ac) => ac.kind === 'liability');
  const orderedRows = [...assetRows, ...liabilityRows];

  const handleSubmit = async () => {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      setError('Pick a month first');
      return;
    }
    if (entries.length === 0) {
      setError('Enter a value for at least one asset class');
      return;
    }
    setError(null);
    try {
      await onSubmit(month, entries);
      onClose();
    } catch {
      setError('Failed to save check-in');
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
          elevation: 0,
          sx: { borderRadius: 3, border: '1px solid', borderColor: 'divider' }
        }
      }}
    >
      <DialogTitle>{editMonth ? `Edit check-in · ${editMonth}` : 'Monthly check-in'}</DialogTitle>
      <DialogContent>
        {!editMonth && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Enter the current value of each asset class. Values are prefilled from your last
            check-in — just adjust what changed. Leave a row empty to skip it.
          </Typography>
        )}
        <TextField
          label="Month"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          disabled={!!editMonth}
          size="small"
          sx={{ mb: 2 }}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        {isMobile ? (
          // A 3-column table (name + two 140px-wide inputs) has no room to
          // breathe on a phone — the inputs get squeezed down to showing a
          // single digit of a 6-figure value. Stacked cards give each field
          // its own full-width row instead.
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {orderedRows.map((ac) => (
              <Box key={ac._id} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: ac.color || '#667eea' }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{ac.name}</Typography>
                  {ac.kind === 'liability' && (
                    <Chip size="small" label="owed" color="warning" variant="outlined" />
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <TextField
                    label={ac.kind === 'liability' ? 'Balance owed (€)' : 'Value (€)'}
                    fullWidth
                    value={form.get(ac._id)?.value ?? ''}
                    onChange={(e) => setField(ac._id, 'value', e.target.value)}
                    size="small"
                    placeholder="—"
                    slotProps={{ inputLabel: { shrink: true }, htmlInput: { inputMode: 'decimal' } }}
                  />
                  {ac.kind !== 'liability' && (
                    <TextField
                      label="Total gain (€)"
                      fullWidth
                      value={form.get(ac._id)?.gain ?? ''}
                      onChange={(e) => setField(ac._id, 'gain', e.target.value)}
                      size="small"
                      placeholder="0"
                      slotProps={{ inputLabel: { shrink: true }, htmlInput: { inputMode: 'decimal' } }}
                    />
                  )}
                </Box>
              </Box>
            ))}
            <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 2 }}>
              {liabilities > 0 && (
                <>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Assets</Typography>
                    <Typography variant="body2">{formatCurrency(assets)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">Liabilities</Typography>
                    <Typography variant="body2">−{formatCurrency(liabilities)}</Typography>
                  </Box>
                </>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ fontWeight: 700 }}>Net worth</Typography>
                <Typography sx={{ fontWeight: 700 }}>{formatCurrency(total)}</Typography>
              </Box>
            </Box>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Asset class</TableCell>
                <TableCell align="right" sx={{ width: 140 }}>Value (€)</TableCell>
                <TableCell align="right" sx={{ width: 140 }}>Total gain (€)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orderedRows.map((ac) => (
                <TableRow key={ac._id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: ac.color || '#667eea' }} />
                      {ac.name}
                      {ac.kind === 'liability' && (
                        <Chip size="small" label="owed" color="warning" variant="outlined" />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      value={form.get(ac._id)?.value ?? ''}
                      onChange={(e) => setField(ac._id, 'value', e.target.value)}
                      size="small"
                      placeholder="—"
                      slotProps={{ htmlInput: { inputMode: 'decimal', style: { textAlign: 'right' } } }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {ac.kind !== 'liability' && (
                      <TextField
                        value={form.get(ac._id)?.gain ?? ''}
                        onChange={(e) => setField(ac._id, 'gain', e.target.value)}
                        size="small"
                        placeholder="0"
                        slotProps={{ htmlInput: { inputMode: 'decimal', style: { textAlign: 'right' } } }}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {liabilities > 0 && (
                <>
                  <TableRow>
                    <TableCell sx={{ border: 0, pb: 0 }}>Assets</TableCell>
                    <TableCell align="right" sx={{ border: 0, pb: 0 }}>{formatCurrency(assets)}</TableCell>
                    <TableCell sx={{ border: 0 }} />
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ border: 0, pt: 0 }}>Liabilities</TableCell>
                    <TableCell align="right" sx={{ border: 0, pt: 0 }}>−{formatCurrency(liabilities)}</TableCell>
                    <TableCell sx={{ border: 0 }} />
                  </TableRow>
                </>
              )}
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Net worth</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(total)}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        )}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={saving}>
          {saving ? 'Saving…' : 'Save check-in'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CheckInDialog;
