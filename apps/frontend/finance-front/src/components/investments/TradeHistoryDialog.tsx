import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  MenuItem,
  IconButton,
  Chip,
  Alert,
  CircularProgress
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useTrades, usePosition, useCreateTrade, useDeleteTrade } from '../../hooks/useTrades';
import { Trade, TradeType, isShareTrade, tradeValue } from '../../services/tradeService';
import { parseNumericInput, formatCurrency, formatPrice } from '../../utils/numberUtils';
import ConfirmationModal from '../ConfirmationModal';
import { todayKey } from '../../utils/dates';

interface TradeHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  ticker: string;
  currency?: string;
  tenantGroupId?: string;
  notify: (message: string, severity: 'success' | 'error') => void;
}

interface TradeForm {
  type: TradeType;
  date: string;
  quantity: string;
  price: string;
  amount: string;
  fees: string;
  notes: string;
}

const emptyForm = (): TradeForm => ({
  type: 'buy',
  date: todayKey(),
  quantity: '',
  price: '',
  amount: '',
  fees: '',
  notes: ''
});

const TYPE_LABELS: Record<TradeType, string> = {
  buy: 'Buy',
  sell: 'Sell',
  dividend: 'Dividend',
  fee: 'Fee'
};

const typeColor = (type: TradeType) =>
  type === 'buy' ? 'primary' : type === 'sell' ? 'warning' : type === 'dividend' ? 'success' : 'default';

const signColor = (v: number) => (v > 0 ? 'success.main' : v < 0 ? 'error.main' : 'text.secondary');

/**
 * The trade log for one ticker, plus the position it replays to. This is where
 * realized P/L and dividend income come from — a holding on its own only knows
 * what is held right now, not what it took to get there.
 */
const TradeHistoryDialog: React.FC<TradeHistoryDialogProps> = ({
  open,
  onClose,
  ticker,
  currency = 'EUR',
  tenantGroupId,
  notify
}) => {
  const { data: trades = [], isLoading } = useTrades(tenantGroupId, open ? ticker : '');
  const { data: position } = usePosition(open ? ticker : null, tenantGroupId);
  const createMutation = useCreateTrade();
  const deleteMutation = useDeleteTrade();

  const [form, setForm] = useState<TradeForm>(emptyForm());
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Trade | null>(null);

  const shareTrade = isShareTrade(form.type);

  const handleAdd = async () => {
    const quantity = parseNumericInput(form.quantity);
    const price = parseNumericInput(form.price);
    const amount = parseNumericInput(form.amount);
    const fees = parseNumericInput(form.fees);

    if (shareTrade && (isNaN(quantity) || quantity <= 0 || isNaN(price))) {
      notify('A buy or sell needs a quantity and a price', 'error');
      return;
    }
    if (!shareTrade && (isNaN(amount) || amount <= 0)) {
      notify(`A ${form.type} needs an amount`, 'error');
      return;
    }

    try {
      await createMutation.mutateAsync({
        ticker,
        type: form.type,
        date: form.date,
        ...(shareTrade ? { quantity, price } : { amount }),
        ...(isNaN(fees) ? {} : { fees }),
        notes: form.notes.trim() || undefined,
        groupId: tenantGroupId
      });
      notify('Trade recorded — the holding has been updated', 'success');
      setForm(emptyForm());
      setAdding(false);
    } catch {
      notify('Failed to record the trade', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?._id) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget._id);
      notify('Trade deleted — the holding has been updated', 'success');
    } catch {
      notify('Failed to delete the trade', 'error');
    }
    setDeleteTarget(null);
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>Trade history · {ticker}</DialogTitle>
        <DialogContent>
          {position && position.tradeCount > 0 && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
                gap: 2,
                p: 2,
                mb: 2,
                borderRadius: 2,
                bgcolor: 'action.hover'
              }}
            >
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Shares held
                </Typography>
                <Typography sx={{ fontWeight: 700 }}>{position.quantity}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Average cost
                </Typography>
                <Typography sx={{ fontWeight: 700 }}>{formatPrice(position.avgBuyPrice, currency)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Realized P/L
                </Typography>
                <Typography sx={{ fontWeight: 700, color: signColor(position.realizedGain) }}>
                  {position.realizedGain >= 0 ? '+' : ''}
                  {formatCurrency(position.realizedGain, currency)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Dividends
                </Typography>
                <Typography sx={{ fontWeight: 700, color: position.dividends > 0 ? 'success.main' : 'text.primary' }}>
                  {formatCurrency(position.dividends, currency)}
                </Typography>
              </Box>
            </Box>
          )}

          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : trades.length === 0 ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              No trades recorded for {ticker}. Adding them here replaces the hand-entered quantity and average price
              with figures derived from what you actually bought and sold.
            </Alert>
          ) : (
            /* The dialog is near full-width on a phone and these columns are not,
                so the row scrolls sideways on its own rather than taking the page
                with it. */
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Quantity</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell align="right">Value</TableCell>
                    <TableCell align="right">Fees</TableCell>
                    <TableCell align="right" sx={{ width: 50 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {trades.map((trade) => (
                    <TableRow key={trade._id} hover>
                      <TableCell>{trade.date.slice(0, 10)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={TYPE_LABELS[trade.type]} color={typeColor(trade.type)} />
                      </TableCell>
                      <TableCell align="right">{isShareTrade(trade.type) ? trade.quantity : '—'}</TableCell>
                      <TableCell align="right">
                        {isShareTrade(trade.type) ? formatPrice(trade.price, currency) : '—'}
                      </TableCell>
                      <TableCell align="right">{formatCurrency(tradeValue(trade), currency)}</TableCell>
                      <TableCell align="right">{trade.fees ? formatCurrency(trade.fees, currency) : '—'}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => setDeleteTarget(trade)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}

          {adding ? (
            <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
                <TextField
                  select
                  label="Type"
                  size="small"
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as TradeType }))}
                >
                  {(Object.keys(TYPE_LABELS) as TradeType[]).map((type) => (
                    <MenuItem key={type} value={type}>
                      {TYPE_LABELS[type]}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Date"
                  type="date"
                  size="small"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  label={`Fees (${currency})`}
                  size="small"
                  value={form.fees}
                  onChange={(e) => setForm((f) => ({ ...f, fees: e.target.value }))}
                  placeholder="0"
                  slotProps={{ inputLabel: { shrink: true }, htmlInput: { inputMode: 'decimal' } }}
                />
                {shareTrade ? (
                  <>
                    <TextField
                      label="Quantity"
                      size="small"
                      required
                      value={form.quantity}
                      onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                      slotProps={{ inputLabel: { shrink: true }, htmlInput: { inputMode: 'decimal' } }}
                    />
                    <TextField
                      label={`Price per share (${currency})`}
                      size="small"
                      required
                      value={form.price}
                      onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                      slotProps={{ inputLabel: { shrink: true }, htmlInput: { inputMode: 'decimal' } }}
                    />
                  </>
                ) : (
                  <TextField
                    label={`Amount (${currency})`}
                    size="small"
                    required
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    slotProps={{ inputLabel: { shrink: true }, htmlInput: { inputMode: 'decimal' } }}
                  />
                )}
                <TextField
                  label="Notes"
                  size="small"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
                <Button size="small" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
                <Button size="small" variant="contained" onClick={handleAdd} disabled={createMutation.isPending}>
                  Record trade
                </Button>
              </Box>
            </Box>
          ) : (
            <Button startIcon={<AddIcon />} onClick={() => setAdding(true)} sx={{ mt: 2 }}>
              Add trade
            </Button>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} variant="contained">
            Done
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmationModal
        open={!!deleteTarget}
        title="Delete trade"
        message={`Delete this ${deleteTarget ? TYPE_LABELS[deleteTarget.type].toLowerCase() : ''}? The holding will be recalculated from the remaining trades.`}
        confirmText="Delete"
        severity="error"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
};

export default TradeHistoryDialog;
