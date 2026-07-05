import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, ShowChart as ShowChartIcon } from '@mui/icons-material';
import { Holding } from '../../services/holdingService';
import { useCreateHolding, useUpdateHolding, useDeleteHolding } from '../../hooks/useHoldings';
import ConfirmationModal from '../ConfirmationModal';
import TickerHistoryModal from '../TickerHistoryModal';
import TickerSearch from './TickerSearch';
import { parseNumericInput, formatCurrency, formatPct } from '../../utils/numberUtils';

interface HoldingsTabProps {
  holdings: Holding[];
  tenantGroupId?: string;
  notify: (message: string, severity: 'success' | 'error') => void;
}

interface HoldingForm {
  ticker: string;
  displayName: string;
  quantity: string;
  avgBuyPrice: string;
}

const emptyForm: HoldingForm = { ticker: '', displayName: '', quantity: '', avgBuyPrice: '' };

const plColor = (v?: number) => (v === undefined ? 'text.secondary' : v > 0 ? 'success.main' : v < 0 ? 'error.main' : 'text.secondary');

const HoldingsTab: React.FC<HoldingsTabProps> = ({ holdings, tenantGroupId, notify }) => {
  const createMutation = useCreateHolding();
  const updateMutation = useUpdateHolding();
  const deleteMutation = useDeleteHolding();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<HoldingForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Holding | null>(null);
  const [historyTicker, setHistoryTicker] = useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (h: Holding) => {
    setEditingId(h._id!);
    setForm({
      ticker: h.ticker,
      displayName: h.displayName || '',
      quantity: String(h.quantity),
      avgBuyPrice: String(h.avgBuyPrice)
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const quantity = parseNumericInput(form.quantity);
    const avgBuyPrice = parseNumericInput(form.avgBuyPrice);
    if (!form.ticker.trim() || isNaN(quantity) || isNaN(avgBuyPrice)) {
      notify('Ticker, quantity and average buy price are required', 'error');
      return;
    }
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data: { ticker: form.ticker.trim(), quantity, avgBuyPrice } });
        notify('Holding updated', 'success');
      } else {
        await createMutation.mutateAsync({
          ticker: form.ticker.trim(),
          displayName: form.displayName.trim() || undefined,
          quantity,
          avgBuyPrice,
          groupId: tenantGroupId
        });
        notify('Holding added — its ticker is now tracked for daily prices', 'success');
      }
      setDialogOpen(false);
    } catch {
      notify('Failed to save holding', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget._id!);
      notify('Holding deleted', 'success');
    } catch {
      notify('Failed to delete holding', 'error');
    }
    setDeleteTarget(null);
  };

  const totals = holdings.reduce(
    (acc, h) => {
      acc.cost += h.avgBuyPrice * h.quantity;
      if (h.currentValue !== undefined) acc.value += h.currentValue;
      if (h.valueIncrease !== undefined) acc.pl += h.valueIncrease;
      return acc;
    },
    { cost: 0, value: 0, pl: 0 }
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Add holding
        </Button>
      </Box>

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Ticker</TableCell>
              <TableCell>Name</TableCell>
              <TableCell align="right">Quantity</TableCell>
              <TableCell align="right">Avg buy</TableCell>
              <TableCell align="right">Cost</TableCell>
              <TableCell align="right">Latest price</TableCell>
              <TableCell align="right">Value</TableCell>
              <TableCell align="right">P/L</TableCell>
              <TableCell align="right">P/L %</TableCell>
              <TableCell align="right" sx={{ width: 130 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {holdings.map((h) => (
              <TableRow key={h._id} hover>
                <TableCell sx={{ fontWeight: 600 }}>{h.ticker}</TableCell>
                <TableCell>{h.displayName || '—'}</TableCell>
                <TableCell align="right">{h.quantity}</TableCell>
                <TableCell align="right">{h.avgBuyPrice.toFixed(3)}</TableCell>
                <TableCell align="right">{formatCurrency(h.avgBuyPrice * h.quantity)}</TableCell>
                <TableCell align="right">
                  {h.latestPrice !== undefined ? (
                    <Tooltip title={h.latestPriceDate ? `As of ${h.latestPriceDate.slice(0, 10)}` : ''}>
                      <span>{h.latestPrice.toFixed(3)}</span>
                    </Tooltip>
                  ) : 'no data'}
                </TableCell>
                <TableCell align="right">{h.currentValue !== undefined ? formatCurrency(h.currentValue) : '—'}</TableCell>
                <TableCell align="right" sx={{ color: plColor(h.valueIncrease) }}>
                  {h.valueIncrease !== undefined ? `${h.valueIncrease >= 0 ? '+' : ''}${formatCurrency(h.valueIncrease)}` : '—'}
                </TableCell>
                <TableCell align="right" sx={{ color: plColor(h.percentIncrease) }}>
                  {h.percentIncrease !== undefined ? formatPct(h.percentIncrease) : '—'}
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => setHistoryTicker(h.ticker)} title="Price history">
                    <ShowChartIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => openEdit(h)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => setDeleteTarget(h)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {holdings.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} sx={{ textAlign: 'center', py: 6 }}>
                  <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                    No holdings yet — add your first ETF or stock position.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {holdings.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} sx={{ fontWeight: 700 }}>Total</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(totals.cost)}</TableCell>
                <TableCell />
                <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(totals.value)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: plColor(totals.pl) }}>
                  {`${totals.pl >= 0 ? '+' : ''}${formatCurrency(totals.pl)}`}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: plColor(totals.pl) }}>
                  {totals.cost > 0 ? formatPct((totals.pl / totals.cost) * 100) : '—'}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </TableContainer>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Edit holding' : 'Add holding'}</DialogTitle>
        <DialogContent>
          {!editingId && (
            <Box sx={{ mb: 2, mt: 1 }}>
              <TickerSearch
                onSelect={(r) => setForm((f) => ({ ...f, ticker: r.symbol, displayName: r.name }))}
              />
            </Box>
          )}
          <TextField
            margin="dense"
            label="Ticker"
            fullWidth
            required
            value={form.ticker}
            onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value.toUpperCase() }))}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          {!editingId && (
            <TextField
              margin="dense"
              label="Display name"
              fullWidth
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          )}
          <TextField
            margin="dense"
            label="Quantity"
            fullWidth
            required
            value={form.quantity}
            onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { inputMode: 'decimal' } }}
          />
          <TextField
            margin="dense"
            label="Average buy price"
            fullWidth
            required
            value={form.avgBuyPrice}
            onChange={(e) => setForm((f) => ({ ...f, avgBuyPrice: e.target.value }))}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { inputMode: 'decimal' } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={createMutation.isPending || updateMutation.isPending}>
            {editingId ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmationModal
        open={!!deleteTarget}
        title="Delete holding"
        message={`Delete ${deleteTarget?.ticker}? This cannot be undone.`}
        confirmText="Delete"
        severity="error"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {historyTicker && (
        <TickerHistoryModal open={!!historyTicker} onClose={() => setHistoryTicker(null)} ticker={historyTicker} />
      )}
    </Box>
  );
};

export default HoldingsTab;
